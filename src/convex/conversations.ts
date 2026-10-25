/**
 * Conversation storage (queries + mutations).
 *
 * History lives in Convex — never only in browser memory. Every function
 * checks the caller owns the conversation, replies are scheduled as internal
 * actions, and a pending message can be cancelled or retried by its owner.
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  DEFAULT_AI_MODEL,
  DEFAULT_TITLE,
  MAX_MESSAGE_LENGTH,
} from "./aiConfig";
import {
  AI_GENERATION_LIMIT,
  enforceOrThrow,
} from "./rateLimit";

function buildTitle(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  if (!compact) return DEFAULT_TITLE;
  return compact.length > 48 ? `${compact.slice(0, 48)}…` : compact;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId as string))
      .order("desc")
      .take(100);

    return conversations.map((conversation) => ({
      _id: conversation._id,
      title: conversation.title,
      preview: conversation.preview ?? "",
      updatedAt: conversation.updatedAt,
      createdAt: conversation._creationTime,
    }));
  },
});

export const messages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== (userId as string)) {
      return [];
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId),
      )
      .order("asc")
      .take(300);
  },
});

export const create = mutation({
  args: { title: v.optional(v.string()) },
  handler: async (ctx, { title }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentification requise.");

    const now = Date.now();
    const cleaned = (title ?? DEFAULT_TITLE).trim() || DEFAULT_TITLE;

    return await ctx.db.insert("conversations", {
      userId: userId as string,
      title: cleaned.slice(0, 120),
      model: DEFAULT_AI_MODEL,
      updatedAt: now,
    });
  },
});

export const rename = mutation({
  args: { conversationId: v.id("conversations"), title: v.string() },
  handler: async (ctx, { conversationId, title }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentification requise.");

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== (userId as string)) {
      throw new Error("Conversation introuvable.");
    }
    const cleaned = title.trim();
    if (!cleaned) throw new Error("Le titre ne peut pas être vide.");

    await ctx.db.patch(conversationId, {
      title: cleaned.slice(0, 120),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentification requise.");

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== (userId as string)) {
      throw new Error("Conversation introuvable.");
    }

    const conversationMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId),
      )
      .collect();
    for (const message of conversationMessages) {
      await ctx.db.delete(message._id);
    }
    await ctx.db.delete(conversationId);
  },
});

/**
 * Append a user message, create the pending assistant placeholder and
 * schedule the provider call. Sending ≠ answered: the reply arrives through
 * the reactive message query when the action completes.
 */
export const postMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, { conversationId, content, model }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentification requise.");

    const trimmed = content.trim();
    if (!trimmed) throw new Error("Le message est vide.");
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      throw new Error(
        `Message trop long (${trimmed.length} caractères, maximum ${MAX_MESSAGE_LENGTH}).`,
      );
    }

    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== (userId as string)) {
      throw new Error("Conversation introuvable.");
    }

    // Spending guard: every send schedules a provider call. Same bucket for
    // retries, so a loop of relances cannot bypass the limit.
    await enforceOrThrow(
      ctx,
      `ai:gen:${userId}`,
      AI_GENERATION_LIMIT.limit,
      AI_GENERATION_LIMIT.windowMs,
    );

    const now = Date.now();

    await ctx.db.insert("messages", {
      conversationId,
      userId: userId as string,
      role: "user",
      content: trimmed,
      status: "complete",
    });

    const assistantMessageId = await ctx.db.insert("messages", {
      conversationId,
      userId: userId as string,
      role: "assistant",
      content: "",
      status: "pending",
    });

    const generatedTitle =
      conversation.title === DEFAULT_TITLE ? buildTitle(trimmed) : undefined;

    await ctx.db.patch(conversationId, {
      updatedAt: now,
      preview: trimmed.slice(0, 160),
      ...(generatedTitle ? { title: generatedTitle } : {}),
      ...(model ? { model } : {}),
    });

    await ctx.scheduler.runAfter(0, internal.ai.generate, {
      conversationId,
      messageId: assistantMessageId,
      model: model ?? conversation.model ?? DEFAULT_AI_MODEL,
    });

    return { assistantMessageId };
  },
});

/** Stop waiting for a reply. The provider call may still finish; its answer
 *  is then discarded because the message is no longer `pending`. */
export const cancelMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentification requise.");

    const message = await ctx.db.get(messageId);
    if (!message || message.userId !== (userId as string)) {
      throw new Error("Message introuvable.");
    }
    if (message.status !== "pending") return;

    await ctx.db.patch(messageId, { status: "cancelled" });
  },
});

/** Re-run a failed or cancelled reply. */
export const retryMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentification requise.");

    const message = await ctx.db.get(messageId);
    if (!message || message.userId !== (userId as string)) {
      throw new Error("Message introuvable.");
    }
    if (message.role !== "assistant") {
      throw new Error("Seule une réponse de l'assistant peut être relancée.");
    }
    if (message.status !== "error" && message.status !== "cancelled") {
      throw new Error("Cette réponse ne peut pas être relancée.");
    }

    // Retries spend provider tokens like a fresh send: same bucket.
    await enforceOrThrow(
      ctx,
      `ai:gen:${userId}`,
      AI_GENERATION_LIMIT.limit,
      AI_GENERATION_LIMIT.windowMs,
    );

    await ctx.db.patch(messageId, { status: "pending" });
    await ctx.db.patch(message.conversationId, { updatedAt: Date.now() });

    await ctx.scheduler.runAfter(0, internal.ai.generate, {
      conversationId: message.conversationId,
      messageId,
      model: DEFAULT_AI_MODEL,
    });
  },
});

/* ------------------------------------------------------------------ */
/* Internal functions used by the AI action                            */
/* ------------------------------------------------------------------ */

export const getMessageInternal = internalQuery({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => await ctx.db.get(messageId),
});

export const getMessagesInternal = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId),
      )
      .order("asc")
      .take(300);
  },
});

export const completeMessage = internalMutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
    model: v.string(),
    latencyMs: v.number(),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    // A cancelled message stays cancelled: never resurrect a stopped reply.
    if (!message || message.status !== "pending") return;

    await ctx.db.patch(args.messageId, {
      content: args.content,
      status: "complete",
      model: args.model,
      latencyMs: args.latencyMs,
      ...(args.promptTokens !== undefined
        ? { promptTokens: args.promptTokens }
        : {}),
      ...(args.completionTokens !== undefined
        ? { completionTokens: args.completionTokens }
        : {}),
    });

    await ctx.db.patch(message.conversationId, {
      updatedAt: Date.now(),
      preview: args.content.slice(0, 160),
    });
  },
});

export const failMessage = internalMutation({
  args: { messageId: v.id("messages"), error: v.string() },
  handler: async (ctx, { messageId, error }) => {
    const message = await ctx.db.get(messageId);
    if (!message || message.status !== "pending") return;

    await ctx.db.patch(messageId, { status: "error", error: error.slice(0, 400) });
  },
});
