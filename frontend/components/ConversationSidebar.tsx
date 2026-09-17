"use client";

import { LogOut, SquarePen, Trash2 } from "lucide-react";
import type { ConversationSummary } from "../lib/api";

export default function ConversationSidebar({
  conversations,
  activeId,
  loading,
  userEmail,
  onOpen,
  onNew,
  onDelete,
  onLogout,
}: {
  conversations: ConversationSummary[];
  activeId: number | null;
  loading: boolean;
  userEmail?: string;
  onOpen: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
  onLogout: () => void;
}) {
  return (
    <>
      <button
        onClick={onNew}
        className="mb-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-800 px-4 text-sm font-medium text-white transition hover:bg-emerald-900"
      >
        <SquarePen className="h-4 w-4" aria-hidden="true" />
        New chat
      </button>

      <h3 className="mb-2 px-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">
        Your conversations
      </h3>

      <nav aria-label="Saved conversations" className="scroll-area -mx-1 min-h-0 flex-1 px-1">
        {loading && (
          <p className="px-2 py-3 text-xs text-gray-500">Loading…</p>
        )}

        {!loading && conversations.length === 0 && (
          <p className="px-2 py-3 text-xs leading-relaxed text-gray-500">
            No conversations yet. Ask your first question and it will be saved
            here.
          </p>
        )}

        <ul className="space-y-1.5">
          {conversations.map((c) => {
            const active = c.id === activeId;
            return (
              <li key={c.id} className="flex items-stretch gap-1">
                <button
                  onClick={() => onOpen(c.id)}
                  aria-current={active ? "true" : undefined}
                  className={`min-h-11 min-w-0 flex-1 rounded-full px-3.5 text-left text-xs transition ${
                    active
                      ? "bg-emerald-800 text-white"
                      : "bg-[#ebe6dc] text-gray-800 hover:bg-[#e6dfd3]"
                  }`}
                >
                  <span className="truncate-safe block">{c.title}</span>
                </button>
                <button
                  onClick={() => onDelete(c.id)}
                  aria-label={`Delete conversation: ${c.title}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-[#e6dfd3] hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-3 border-t border-[#e6dfd3] pt-3">
        {userEmail && (
          <p className="truncate-safe mb-1 px-1 text-[11px] text-gray-500" title={userEmail}>
            {userEmail}
          </p>
        )}
        <button
          onClick={onLogout}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-3 text-xs font-medium text-emerald-900 transition hover:bg-[#ebe6dc]"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Log out
        </button>
      </div>
    </>
  );
}
