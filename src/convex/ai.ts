"use node";

/**
 * AI provider bridge.
 *
 * This is the ONLY file that talks to an AI provider: changing supplier means
 * editing this module, the rest of the console is untouched.
 *
 * - keys are read from the deployment environment, never sent to the browser;
 * - `generate` is an internal action scheduled by a mutation (already
 *   authenticated and rate-checked there — see rateLimit.ts);
 * - `probe` is throttled server-side per identity before any provider call;
 * - provider failures are mapped to explicit messages with credentials
 *   stripped, and a reply produced after the user pressed "stop" is dropped.
 */

import { vly } from "../lib/vly-integrations";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import {
  AI_MODELS,
  AI_SYSTEM_PROMPT,
  DEFAULT_AI_MODEL,
  MAX_CONTEXT_MESSAGES,
  MAX_TOKENS,
  TEMPERATURE,
  isAllowedModel,
  sanitizeError,
} from "./aiConfig";
import { AI_PROBE_LIMIT } from "./rateLimit";

interface ProviderResult {
  ok: boolean;
  text?: string;
  error?: string;
  promptTokens?: number;
  completionTokens?: number;
}

async function complete(
  model: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): Promise<ProviderResult> {
  const response = await vly.ai.completion({
    model,
    messages,
    temperature: TEMPERATURE,
    maxTokens: MAX_TOKENS,
  });

  const text = response.data?.choices?.[0]?.message?.content?.trim();
  if (!response.success || !text) {
    return {
      ok: false,
      error: sanitizeError(
        response.error ?? "Le fournisseur n'a renvoyé aucun contenu.",
      ),
    };
  }

  return {
    ok: true,
    text,
    promptTokens: response.data?.usage?.promptTokens,
    completionTokens: response.data?.usage?.completionTokens,
  };
}

function hasIntegrationKey(): boolean {
  return Boolean(process.env.VLY_INTEGRATION_KEY);
}

/**
 * Generate the assistant reply for a pending message.
 * Scheduled by `conversations.postMessage` / `conversations.retryMessage`.
 */
export const generate = internalAction({
  args: {
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    model: v.string(),
  },
  handler: async (ctx: ActionCtx, args) => {
    const pending = await ctx.runQuery(
      internal.conversations.getMessageInternal,
      { messageId: args.messageId },
    );
    if (!pending || pending.status !== "pending") return;

    const model = isAllowedModel(args.model) ? args.model : DEFAULT_AI_MODEL;

    if (!hasIntegrationKey()) {
      await ctx.runMutation(internal.conversations.failMessage, {
        messageId: args.messageId,
        error:
          "Aucun fournisseur IA configuré côté serveur (clé d'intégration absente de l'environnement Convex).",
      });
      return;
    }

    const history = await ctx.runQuery(
      internal.conversations.getMessagesInternal,
      { conversationId: args.conversationId },
    );

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: AI_SYSTEM_PROMPT },
      ...history
        .filter(
          (message) =>
            message.status === "complete" &&
            message.content.trim().length > 0,
        )
        .slice(-MAX_CONTEXT_MESSAGES)
        .map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        })),
    ];

    const startedAt = Date.now();

    try {
      const result = await complete(model, messages);
      const latencyMs = Date.now() - startedAt;

      if (!result.ok || !result.text) {
        await ctx.runMutation(internal.conversations.failMessage, {
          messageId: args.messageId,
          error: result.error ?? "Le fournisseur IA est indisponible.",
        });
        return;
      }

      // The user may have pressed stop while the provider was working.
      const current = await ctx.runQuery(
        internal.conversations.getMessageInternal,
        { messageId: args.messageId },
      );
      if (!current || current.status !== "pending") return;

      await ctx.runMutation(internal.conversations.completeMessage, {
        messageId: args.messageId,
        content: result.text,
        model,
        latencyMs,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      });
    } catch (error) {
      await ctx.runMutation(internal.conversations.failMessage, {
        messageId: args.messageId,
        error: sanitizeError(
          error instanceof Error ? error.message : "Erreur inconnue.",
        ),
      });
    }
  },
});

/** Provider configuration, exposed so the UI can state it honestly. */
export const status = action({
  args: {},
  handler: async () => {
    const configured = hasIntegrationKey();
    return {
      configured,
      provider: configured
        ? "Passerelle d'intégration de la plateforme"
        : "Aucun fournisseur configuré",
      models: AI_MODELS,
      defaultModel: DEFAULT_AI_MODEL,
    };
  },
});

/**
 * Live connectivity test of the provider (one minimal completion).
 * Requires a session so a public caller cannot trigger it anonymously.
 */
/** Explicit so the return type never depends on `internal` (type cycle). */
export type ProbeResult =
  | { ok: true; model: string; latencyMs: number; sample: string }
  | { ok: false; error: string; latencyMs?: number };

export const probe = action({
  args: {},
  handler: async (ctx: ActionCtx): Promise<ProbeResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { ok: false as const, error: "Authentification requise." };
    }

    // Each probe is a real completion: throttle it server-side per identity
    // (anonymous sessions included) BEFORE contacting the provider.
    const rate: { ok: boolean; retryAfterMs: number; message: string } =
      await ctx.runMutation(internal.rateLimit.consume, {
      key: `ai:probe:${identity.subject}`,
      limit: AI_PROBE_LIMIT.limit,
      windowMs: AI_PROBE_LIMIT.windowMs,
    });
    if (!rate.ok) {
      return { ok: false as const, error: rate.message };
    }

    if (!hasIntegrationKey()) {
      return {
        ok: false as const,
        error:
          "Aucune clé d'intégration configurée côté serveur (VLY_INTEGRATION_KEY).",
      };
    }

    const startedAt = Date.now();
    try {
      const result = await complete(DEFAULT_AI_MODEL, [
        { role: "user", content: "Réponds uniquement par : OK" },
      ]);
      const latencyMs = Date.now() - startedAt;
      if (!result.ok || !result.text) {
        return {
          ok: false as const,
          error: result.error ?? "Réponse vide du fournisseur.",
          latencyMs,
        };
      }
      return {
        ok: true as const,
        model: DEFAULT_AI_MODEL,
        latencyMs,
        sample: result.text.slice(0, 60),
      };
    } catch (error) {
      return {
        ok: false as const,
        error: sanitizeError(
          error instanceof Error ? error.message : "Erreur inconnue.",
        ),
        latencyMs: Date.now() - startedAt,
      };
    }
  },
});
