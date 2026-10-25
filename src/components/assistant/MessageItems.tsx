/**
 * Chat bubbles: user and assistant messages, including the pending, failed and
 * cancelled states of a generation.
 */

import { Markdown } from "@/components/assistant/Markdown";
import { Button } from "@/components/ui/button";
import type { Id } from "@/convex/_generated/dataModel";
import { useFormat } from "@/hooks/use-format";
import type { ConversationMessage } from "@/hooks/use-conversations";
import { Bot, Check, Copy, Loader2, RotateCcw, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function AssistantMessage({
  message,
  onRetry,
}: {
  message: ConversationMessage;
  onRetry: () => void;
}) {
  const format = useFormat();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
      toast.success("Réponse copiée.");
    } catch {
      toast.error("Copie impossible depuis ce navigateur.");
    }
  };

  return (
    <div className="flex gap-3 rounded-lg border border-border/60 bg-primary/[0.04] p-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Bot className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold">MILES IA</span>
          <span className="text-[11px] text-muted-foreground">
            {format.dateTime(message._creationTime)}
          </span>
          {message.status === "complete" && message.latencyMs ? (
            <span className="mono-value text-[11px] text-muted-foreground">
              {Math.round(message.latencyMs)} ms
              {message.model ? ` · ${message.model}` : ""}
            </span>
          ) : null}
          {message.status === "pending" ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              Génération en cours…
            </span>
          ) : null}
        </div>

        {message.status === "pending" ? (
          <div className="flex items-center gap-1.5" aria-live="polite">
            <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
          </div>
        ) : message.status === "error" ? (
          <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            <p className="font-medium">La génération a échoué.</p>
            <p className="mt-1 text-xs opacity-90">
              {message.error ?? "Erreur inconnue du fournisseur IA."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 cursor-pointer gap-1.5 border-danger/40 bg-transparent text-danger hover:bg-danger/10 hover:text-danger"
              onClick={onRetry}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Réessayer
            </Button>
          </div>
        ) : message.status === "cancelled" ? (
          <div className="rounded-md border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
            <span>Génération interrompue.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-3 cursor-pointer gap-1.5"
              onClick={onRetry}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Reprendre
            </Button>
          </div>
        ) : (
          <>
            <Markdown content={message.content} />
            <div className="mt-3 flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 cursor-pointer gap-1.5 text-xs"
                onClick={() => void copy()}
              >
                {copied ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <Copy className="size-3.5" aria-hidden />
                )}
                Copier
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function UserMessage({ message }: { message: ConversationMessage }) {
  const format = useFormat();
  return (
    <div className="flex gap-3 rounded-lg border border-border/60 bg-muted/40 p-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <User className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold">Vous</span>
          <span className="text-[11px] text-muted-foreground">
            {format.dateTime(message._creationTime)}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-6">
          {message.content}
        </p>
      </div>
    </div>
  );
}

/** Dispatch on role so pages stay declarative. */
export function ChatMessage({
  message,
  onRetry,
}: {
  message: ConversationMessage;
  onRetry: (messageId: Id<"messages">) => void;
}) {
  if (message.role === "user") {
    return <UserMessage message={message} />;
  }
  return (
    <AssistantMessage message={message} onRetry={() => onRetry(message._id)} />
  );
}
