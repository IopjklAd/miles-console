/**
 * Historique des conversations — search, open, rename and delete.
 * Storage is server-side (Convex); nothing depends on browser memory.
 */

import { ConversationList } from "@/components/assistant/ConversationList";
import { EmptyState, ErrorState, LoadingState } from "@/components/miles/Feedback";
import { PageHeader } from "@/components/miles/PageHeader";
import { Panel, PanelBody } from "@/components/miles/Panel";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/hooks/use-format";
import { useConversations } from "@/hooks/use-conversations";
import { motion } from "framer-motion";
import { MessagesSquare, MessageSquarePlus } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

export default function Conversations() {
  const { conversations, isLoading, create } = useConversations();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const format = useFormat();

  const activeId = (searchParams.get("c") as Id<"conversations"> | null) ?? null;
  const count = conversations?.length ?? 0;
  const lastActivity =
    conversations && conversations.length > 0
      ? Math.max(...conversations.map((item) => item.updatedAt))
      : null;

  const openConversation = (id: Id<"conversations">) => {
    setSearchParams({ c: id }, { replace: false });
    navigate(`/dashboard/assistant?c=${id}`);
  };

  const startConversation = async () => {
    try {
      const id = await create({});
      navigate(`/dashboard/assistant?c=${id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Création impossible.",
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col gap-4"
    >
      <PageHeader
        title="Conversations"
        description={
          isLoading
            ? "Chargement de l'historique…"
            : `${count} conversation${count > 1 ? "s" : ""}${
                lastActivity
                  ? ` · dernière activité ${format.relative(lastActivity)}`
                  : ""
              }`
        }
        actions={
          <Button
            type="button"
            size="sm"
            className="cursor-pointer gap-1.5"
            onClick={() => void startConversation()}
          >
            <MessageSquarePlus className="size-4" aria-hidden />
            Nouvelle conversation
          </Button>
        }
      />

      <Panel>
        <PanelBody className="p-4">
          {isLoading ? (
            <LoadingState label="Chargement des conversations…" />
          ) : conversations === null ? (
            <ErrorState
              message="Impossible de charger l'historique des conversations."
              onRetry={() => window.location.reload()}
              retryLabel="Réessayer"
            />
          ) : count === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="Aucune conversation pour l'instant"
              description="Vos échanges avec l'assistant sont conservés côté serveur : lancez la première conversation pour créer l'historique."
              action={
                <Button
                  type="button"
                  size="sm"
                  className="cursor-pointer gap-1.5"
                  onClick={() => void startConversation()}
                >
                  <MessageSquarePlus className="size-4" aria-hidden />
                  Ouvrir l'assistant
                </Button>
              }
            />
          ) : (
            <ConversationList
              activeId={activeId}
              onSelect={openConversation}
              showSearch
              showPreview
              maxHeight="max-h-[60vh]"
            />
          )}
        </PanelBody>
      </Panel>
    </motion.div>
  );
}
