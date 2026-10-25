/**
 * React bindings for conversations and the AI provider status.
 *
 * History is backed by Convex (reactive queries): it survives a reload and
 * updates without manual polling. The provider probe is the only place that
 * triggers a real completion from the UI.
 */

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export type ConversationSummary = {
  _id: Id<"conversations">;
  title: string;
  preview: string;
  updatedAt: number;
  createdAt: number;
};

export type ConversationMessage = Doc<"messages">;

export interface AiStatusInfo {
  configured: boolean;
  provider: string;
  models: string[];
  defaultModel: string;
}

export function useConversations() {
  const conversations = useQuery(api.conversations.list, {});
  const create = useMutation(api.conversations.create);
  const rename = useMutation(api.conversations.rename);
  const remove = useMutation(api.conversations.remove);

  return {
    conversations: (conversations ?? null) as ConversationSummary[] | null,
    isLoading: conversations === undefined,
    create,
    rename,
    remove,
  };
}

export function useConversationMessages(
  conversationId: Id<"conversations"> | null,
) {
  const messages = useQuery(
    api.conversations.messages,
    conversationId ? { conversationId } : "skip",
  );
  const post = useMutation(api.conversations.postMessage);
  const cancel = useMutation(api.conversations.cancelMessage);
  const retry = useMutation(api.conversations.retryMessage);
  const list = (messages ?? null) as ConversationMessage[] | null;

  return {
    messages: list,
    isLoading: conversationId !== null && messages === undefined,
    post,
    cancel,
    retry,
    isGenerating: (list ?? []).some((message) => message.status === "pending"),
    pendingMessageId:
      (list ?? []).find((message) => message.status === "pending")?._id ?? null,
  };
}

/** Provider configuration + optional live connectivity probe. */
export function useAiStatus() {
  const statusAction = useAction(api.ai.status);
  const probeAction = useAction(api.ai.probe);
  const [status, setStatus] = useState<AiStatusInfo | null>(null);
  const [probing, setProbing] = useState(false);

  const load = useCallback(() => {
    statusAction({})
      .then((result) => setStatus(result as AiStatusInfo))
      .catch(() => setStatus(null));
  }, [statusAction]);

  useEffect(() => {
    load();
  }, [load]);

  const probe = useCallback(async () => {
    setProbing(true);
    try {
      const result = (await probeAction({})) as {
        ok: boolean;
        error?: string;
        latencyMs?: number;
        model?: string;
      };
      if (result.ok) {
        toast.success(
          `Fournisseur IA joignable — ${result.model ?? ""} en ${result.latencyMs ?? 0} ms`,
        );
      } else {
        toast.error(result.error ?? "Le fournisseur IA ne répond pas.");
      }
      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Test impossible.";
      toast.error(message);
      return { ok: false, error: message };
    } finally {
      setProbing(false);
    }
  }, [probeAction]);

  return { status, reload: load, probe, probing };
}
