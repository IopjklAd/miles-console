/**
 * Conversation list with search, rename and delete confirmation.
 * Used by the assistant sidebar and the history page.
 */

import { LoadingState } from "@/components/miles/Feedback";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { Id } from "@/convex/_generated/dataModel";
import { useFormat } from "@/hooks/use-format";
import { useConversations } from "@/hooks/use-conversations";
import { cn } from "@/lib/utils";
import { EllipsisVertical, Pencil, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export function ConversationList({
  activeId,
  onSelect,
  showSearch = false,
  showPreview = false,
  maxHeight = "max-h-[60vh]",
}: {
  activeId: Id<"conversations"> | null;
  onSelect: (id: Id<"conversations">) => void;
  showSearch?: boolean;
  showPreview?: boolean;
  maxHeight?: string;
}) {
  const { conversations, isLoading, rename, remove } = useConversations();
  const format = useFormat();
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<Id<"conversations"> | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<Id<"conversations"> | null>(null);

  const filtered = useMemo(() => {
    const list = conversations ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter(
      (conversation) =>
        conversation.title.toLowerCase().includes(query) ||
        conversation.preview.toLowerCase().includes(query),
    );
  }, [conversations, search]);

  const submitRename = async () => {
    if (!renamingId) return;
    try {
      await rename({ conversationId: renamingId, title: renameValue });
      toast.success("Conversation renommée.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Renommage impossible.",
      );
    } finally {
      setRenamingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await remove({ conversationId: deletingId });
      toast.success("Conversation supprimée.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Suppression impossible.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {showSearch ? (
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher une conversation…"
            className="pl-9"
            aria-label="Rechercher une conversation"
          />
        </div>
      ) : null}

      <div className={cn("min-h-0 flex-1 overflow-y-auto", maxHeight)}>
        {isLoading ? (
          <LoadingState label="Chargement des conversations…" />
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-4 text-center">
            <p className="text-sm font-medium">
              {search ? "Aucun résultat" : "Aucune conversation"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {search
                ? "Essayez un autre mot-clé."
                : "Lancez une discussion depuis l'assistant IA."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((conversation) => {
              const active = conversation._id === activeId;
              return (
                <li key={conversation._id}>
                  <div
                    className={cn(
                      "group flex items-start gap-1 rounded-md border border-transparent px-2 py-2 transition-colors hover:bg-accent/60",
                      active && "border-border/70 bg-accent",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(conversation._id)}
                      className="min-w-0 flex-1 cursor-pointer text-left"
                    >
                      <span className="block truncate text-sm font-medium">
                        {conversation.title}
                      </span>
                      {showPreview && conversation.preview ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {conversation.preview}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {format.relative(conversation.updatedAt)}
                      </span>
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                          aria-label={`Actions pour ${conversation.title}`}
                        >
                          <EllipsisVertical className="size-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onSelect={() => {
                            setRenamingId(conversation._id);
                            setRenameValue(conversation.title);
                          }}
                        >
                          <Pencil className="size-4" aria-hidden />
                          Renommer
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer text-danger focus:text-danger"
                          onSelect={() => setDeletingId(conversation._id)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog
        open={renamingId !== null}
        onOpenChange={(open) => {
          if (!open) setRenamingId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Renommer la conversation</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            placeholder="Titre de la conversation"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") void submitRename();
            }}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer"
              onClick={() => setRenamingId(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              onClick={() => void submitRename()}
              disabled={!renameValue.trim()}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la conversation ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'historique de cette conversation sera définitivement supprimé du
              serveur. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
