/**
 * Assistant IA — conversation interface.
 *
 * Replies come from the Convex action (`convex/ai.ts`), never from a key in
 * the browser. Sending creates a pending placeholder, the provider answers
 * asynchronously, and the user can stop or retry a generation.
 *
 * Data access lives in `hooks/use-conversations.ts`, presentation helpers in
 * `components/assistant/*`.
 */

import { ChatMessage } from "@/components/assistant/MessageItems";
import { ConversationList } from "@/components/assistant/ConversationList";
import {
  ErrorState,
  InlineAlert,
  LoadingState,
} from "@/components/miles/Feedback";
import { PageHeader } from "@/components/miles/PageHeader";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/miles/Panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import {
  useAiStatus,
  useConversationMessages,
  useConversations,
} from "@/hooks/use-conversations";
import { cn } from "@/lib/utils";
import { useMiles } from "@/state/miles";
import { useSettings } from "@/state/settings";
import { motion } from "framer-motion";
import {
  Bot,
  Loader2,
  MessageSquarePlus,
  Send,
  Square,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

const SUGGESTIONS = [
  "Résume l'état attendu du système MILES.",
  "Quels journaux vérifier en priorité en cas d'erreur ?",
  "Comment ajouter un capteur à la supervision ?",
];

export default function Assistant() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings } = useSettings();
  const { pushNotification } = useMiles();
  const { user } = useAuth();
  const { conversations, create } = useConversations();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const requestedId = searchParams.get("c") as Id<"conversations"> | null;
  const activeId = useMemo<Id<"conversations"> | null>(() => {
    if (!conversations || conversations.length === 0) return null;
    const requested = conversations.find((item) => item._id === requestedId);
    return requested ? requested._id : conversations[0]._id;
  }, [conversations, requestedId]);

  const {
    messages,
    isLoading: messagesLoading,
    post,
    cancel,
    retry,
    isGenerating,
    pendingMessageId,
  } = useConversationMessages(activeId);
  const { status: aiStatus, probe, probing } = useAiStatus();

  const activeConversation = conversations?.find(
    (item) => item._id === activeId,
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages?.length, isGenerating]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending || isGenerating) return;

    setSending(true);
    try {
      let id = activeId;
      if (!id) id = await create({});
      await post({ conversationId: id, content, model: settings.aiModel });
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      setSearchParams({ c: id }, { replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Envoi impossible.";
      toast.error(message);
      pushNotification({
        title: "Erreur de l'assistant IA",
        message,
        severity: "error",
        dedupeKey: "ai:send-failed",
        origin: "app",
      });
    } finally {
      setSending(false);
    }
  };

  const handleStop = async () => {
    if (!pendingMessageId) return;
    try {
      await cancel({ messageId: pendingMessageId });
      toast.info("Génération interrompue.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Interruption impossible.",
      );
    }
  };

  const handleRetry = async (messageId: Id<"messages">) => {
    try {
      await retry({ messageId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Relance impossible.",
      );
    }
  };

  const providerReady = aiStatus?.configured ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col gap-4"
    >
      <PageHeader
        title="Assistant IA"
        description={
          aiStatus ? (
            <span>
              Fournisseur :{" "}
              <span className="text-foreground">{aiStatus.provider}</span>
              {" · modèle "}
              <span className="mono-value text-foreground">
                {settings.aiModel}
              </span>
            </span>
          ) : (
            "Consultation de l'état du fournisseur IA…"
          )
        }
        actions={
          <>
            <Link
              to="/dashboard/conversations"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
            >
              Historique
            </Link>
            <Button
              type="button"
              size="sm"
              className="cursor-pointer gap-1.5"
              onClick={() => {
                void create({}).then((id) => setSearchParams({ c: id }));
              }}
            >
              <MessageSquarePlus className="size-4" aria-hidden />
              Nouvelle conversation
            </Button>
          </>
        }
      />

      {aiStatus && !providerReady ? (
        <InlineAlert
          tone="warning"
          title="Aucun fournisseur IA configuré"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 cursor-pointer border-warning/40 bg-transparent text-warning hover:bg-warning/10 hover:text-warning"
              onClick={() => void probe()}
              disabled={probing}
            >
              {probing ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : null}
              Tester
            </Button>
          }
        >
          Les clés restent côté serveur : renseignez la clé d'intégration dans
          l'environnement Convex. Les autres pages de la console restent
          utilisables sans IA.
        </InlineAlert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="hidden min-h-0 flex-col lg:flex">
          <Panel className="flex max-h-[70vh] flex-col">
            <PanelHeader className="py-3">
              <PanelTitle>Conversations</PanelTitle>
            </PanelHeader>
            <PanelBody className="flex min-h-0 flex-1 flex-col py-3">
              <ConversationList
                activeId={activeId}
                onSelect={(id) => setSearchParams({ c: id })}
                maxHeight="max-h-[52vh]"
              />
            </PanelBody>
          </Panel>
        </aside>

        <Panel className="flex min-h-0 flex-col">
          <PanelHeader className="py-3">
            <div className="min-w-0">
              <PanelTitle className="truncate">
                {activeConversation?.title ?? "Nouvelle conversation"}
              </PanelTitle>
              <PanelDescription>
                {messages && messages.length > 0
                  ? `${messages.length} message${messages.length > 1 ? "s" : ""}`
                  : "Aucun message pour l'instant"}
              </PanelDescription>
            </div>
            <div className="flex items-center gap-2">
              {aiStatus ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
                    providerReady
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-warning/35 bg-warning/10 text-warning",
                  )}
                >
                  {providerReady ? "IA prête" : "IA non configurée"}
                </span>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 cursor-pointer gap-1.5"
                onClick={() => void probe()}
                disabled={probing}
              >
                {probing ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : null}
                Tester
              </Button>
            </div>
          </PanelHeader>

          <div className="min-h-[320px] max-h-[62vh] flex-1 overflow-y-auto px-4 py-4">
            {!activeId ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    Posez une question à MILES
                  </p>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    L'assistant répond via le backend sécurisé : aucune clé
                    d'API n'est stockée dans le navigateur.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="cursor-pointer rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      onClick={() => setInput(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : messagesLoading ? (
              <LoadingState label="Chargement de la conversation…" />
            ) : messages && messages.length > 0 ? (
              <div className="flex flex-col gap-3">
                {messages.map((message) => (
                  <ChatMessage
                    key={message._id}
                    message={message}
                    onRetry={(id) => void handleRetry(id)}
                  />
                ))}
                <div ref={bottomRef} />
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
                <p className="text-sm font-medium">Conversation vide</p>
                <p className="text-sm text-muted-foreground">
                  Envoyez un message pour démarrer.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-border/60 p-3">
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  const element = event.target;
                  element.style.height = "auto";
                  element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Écrivez votre message… (Entrée pour envoyer, Maj+Entrée pour une nouvelle ligne)"
                className="max-h-44 min-h-11 resize-none"
                rows={1}
                disabled={sending}
                aria-label="Message pour l'assistant"
              />
              {isGenerating ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 cursor-pointer"
                  onClick={() => void handleStop()}
                  aria-label="Interrompre la génération"
                >
                  <Square className="size-4" aria-hidden />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  className="h-10 w-10 shrink-0 cursor-pointer"
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || sending}
                  aria-label="Envoyer le message"
                >
                  <Send className="size-4" aria-hidden />
                </Button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>
                {providerReady
                  ? `Modèle ${settings.aiModel} via le backend Convex`
                  : "Envoi possible : le fournisseur répondra par une erreur tant qu'il n'est pas configuré"}
              </span>
              <span>
                {user?.email ? `Session : ${user.email}` : "Session opérateur"}
              </span>
            </div>
          </div>
        </Panel>
      </div>

      {activeId && !conversations?.some((item) => item._id === activeId) ? (
        <ErrorState
          message="Cette conversation n'existe plus ou n'est pas accessible."
          onRetry={() => setSearchParams({}, { replace: true })}
          retryLabel="Revenir à la liste"
        />
      ) : null}
    </motion.div>
  );
}
