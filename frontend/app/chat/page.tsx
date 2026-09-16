"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SquarePen,
  Send,
  PanelLeft,
  LogOut,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  ApiError,
  ConversationSummary,
  Source,
  api,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

type Message = {
  role: "user" | "assistant";
  content: string;
  status?: "ok" | "general" | "refusal" | null;
  sources?: Source[];
};

const LANGUAGES: { code: "en" | "ar" | "ur"; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ar", label: "Arabic" },
  { code: "ur", label: "Urdu" },
];

export default function ChatPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvo, setLoadingConvo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSourcesFor, setShowSourcesFor] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [language, setLanguage] = useState<"en" | "ar" | "ur">("en");

  const scrollRef = useRef<HTMLDivElement>(null);

  // Guard: the API rejects unauthenticated calls regardless, but sending
  // the visitor to the login page is friendlier than an error wall.
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await api.listConversations());
    } catch {
      /* sidebar is non-critical; the chat still works */
    }
  }, []);

  useEffect(() => {
    if (user) loadConversations();
  }, [user, loadConversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  async function openConversation(id: number) {
    setMobileSidebarOpen(false);
    setLoadingConvo(true);
    setError(null);
    try {
      const detail = await api.getConversation(id);
      setConversationId(detail.id);
      setMessages(
        detail.messages.map((m) => ({
          role: m.role,
          content: m.content,
          status: m.status,
          sources: m.sources,
        }))
      );
      setShowSourcesFor(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not open that conversation."
      );
    } finally {
      setLoadingConvo(false);
    }
  }

  function startNewChat() {
    // The conversation row is created lazily by the first /ask, so a new
    // chat costs nothing until something is actually asked.
    setConversationId(null);
    setMessages([]);
    setInput("");
    setShowSourcesFor(null);
    setError(null);
    setMobileSidebarOpen(false);
  }

  async function removeConversation(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await api.deleteConversation(id);
      if (id === conversationId) startNewChat();
      loadConversations();
    } catch {
      setError("Could not delete that conversation.");
    }
  }

  // Takes the text explicitly so quick-actions do not depend on `input`
  // state that has not been applied yet.
  async function sendMessage(text?: string) {
    const question = (text ?? input).trim();
    if (!question || sending) return;

    const outgoing: Message = { role: "user", content: question };
    const updated = [...messages, outgoing];
    setMessages(updated);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const data = await api.ask({
        question,
        history: updated.map((m) => ({ role: m.role, content: m.content })),
        language,
        conversation_id: conversationId,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data.answer ??
            data.message ??
            "Unable to answer based on available sources.",
          status: data.status,
          sources: data.sources ?? [],
        },
      ]);

      if (data.conversation_id && data.conversation_id !== conversationId) {
        setConversationId(data.conversation_id);
      }
      loadConversations();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setMessages((prev) => prev.slice(0, -1));
      setInput(question);
      setError(
        err instanceof ApiError
          ? err.message
          : "Error connecting to the Aalim backend."
      );
    } finally {
      setSending(false);
    }
  }

  const LanguageButtons = () => (
    <div className="mt-3 flex justify-center gap-2">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => setLanguage(code)}
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            language === code
              ? "bg-emerald-900 text-white"
              : "bg-[#ebe6dc] text-gray-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const SidebarContent = () => (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <button
          onClick={() => setShowHistory((p) => !p)}
          className="mb-4 flex w-full items-center justify-between text-lg font-semibold text-emerald-900"
        >
          <span>Your conversations</span>
          <PanelLeft
            className={`h-6 w-6 transition-transform ${showHistory ? "rotate-180" : ""}`}
          />
        </button>

        {showHistory && (
          <div className="space-y-1.5">
            {conversations.length === 0 && (
              <p className="px-1 text-xs text-gray-500">
                No conversations yet. Ask your first question.
              </p>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => openConversation(c.id)}
                className={`group flex cursor-pointer items-center gap-1 rounded-full px-3 py-2 text-xs ${
                  c.id === conversationId
                    ? "bg-emerald-800 text-white"
                    : "bg-[#ebe6dc] text-gray-700 hover:bg-[#e6dfd3]"
                }`}
              >
                <span className="flex-1 truncate">{c.title}</span>
                <button
                  onClick={(e) => removeConversation(c.id, e)}
                  aria-label={`Delete conversation: ${c.title}`}
                  className="opacity-0 transition group-hover:opacity-70 hover:!opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-[#e6dfd3] pt-4">
        <button
          onClick={startNewChat}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-full bg-emerald-800 py-2.5 text-xs font-medium text-white hover:bg-emerald-900"
        >
          <SquarePen className="h-4 w-4" />
          New chat
        </button>

        <p className="mb-2 truncate px-1 text-[11px] text-gray-500" title={user?.email}>
          {user?.email}
        </p>
        <button
          onClick={async () => {
            await logout();
            router.replace("/");
          }}
          className="flex w-full items-center justify-center gap-2 rounded-full px-3 py-2 text-xs text-emerald-900 hover:bg-[#ebe6dc]"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </>
  );

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f1e8]">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-800" />
      </div>
    );
  }

  return (
    <>
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="absolute top-0 left-0 flex h-full w-64 flex-col justify-between bg-[#f9f6ef] p-4 shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex h-screen bg-[#f5f1e8] text-gray-900">
        <aside className="hidden w-64 flex-col justify-between border-r border-[#e6dfd3] bg-[#f9f6ef] p-4 md:flex">
          <SidebarContent />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="relative border-b border-[#e6dfd3] bg-[#f9f6ef] px-6 py-2">
            <div className="absolute top-4 left-4 md:hidden">
              <button
                onClick={() => setMobileSidebarOpen((p) => !p)}
                className="rounded-lg p-2 hover:bg-[#ebe6dc]"
                aria-label="Open menu"
              >
                <PanelLeft className="h-6 w-6 text-emerald-900" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-1">
              <Image
                src="/aalimheader.png"
                alt="Aalim"
                width={220}
                height={60}
                priority
                className="h-auto w-[160px] sm:w-[220px]"
              />
              <p className="text-center text-sm leading-tight text-gray-700">
                An AI Companion for Muslims, grounded in Qur’an and authentic
                Hadith.
              </p>
              <LanguageButtons />
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto p-6">
            {loadingConvo && (
              <div className="flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-800" />
              </div>
            )}

            {!loadingConvo && messages.length === 0 && (
              <div className="mx-auto max-w-md pt-10 text-center">
                <Image
                  src="/AALIM.png"
                  alt=""
                  width={72}
                  height={72}
                  className="mx-auto mb-4 opacity-80"
                />
                <p className="text-sm text-gray-600">
                  Ask about a verse, a hadith, or a topic — Aalim will show you
                  the sources behind the answer.
                </p>
              </div>
            )}

            {messages.map((msg, i) => {
              const isAssistant = msg.role === "assistant";
              let badge: string | null = null;
              let badgeClass = "";

              if (isAssistant) {
                if (msg.status === "ok") {
                  badge = "📚 Cited from Qur’an & Sahih Hadith";
                  badgeClass = "bg-emerald-700 text-white";
                } else if (msg.status === "general") {
                  badge = "💬 General Sunni explanation";
                  badgeClass = "bg-[#e8dcc7] text-gray-800";
                } else if (msg.status === "refusal") {
                  badge = "🚫 Unable to answer";
                  badgeClass = "bg-gray-300 text-gray-800";
                }
              }

              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {isAssistant && (
                    <Image
                      src="/AALIM.png"
                      alt=""
                      width={65}
                      height={65}
                      className="mt-1 hidden opacity-90 sm:block"
                    />
                  )}

                  <div className="min-w-0 max-w-xl space-y-1">
                    {badge && (
                      <div
                        className={`inline-block rounded-full px-3 py-1 text-[11px] font-medium ${badgeClass}`}
                      >
                        {badge}
                      </div>
                    )}

                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-emerald-800 text-white"
                          : "bg-[#ebe6dc] text-gray-900"
                      }`}
                    >
                      {msg.content}
                    </div>

                    {isAssistant && (msg.sources?.length ?? 0) > 0 && (
                      <button
                        onClick={() =>
                          setShowSourcesFor(showSourcesFor === i ? null : i)
                        }
                        className="rounded-full bg-[#f0eadf] px-3 py-1 text-xs hover:bg-[#e6dfd3]"
                      >
                        {showSourcesFor === i ? "Hide" : "Show"}{" "}
                        {msg.sources!.length} source
                        {msg.sources!.length === 1 ? "" : "s"}
                      </button>
                    )}

                    {isAssistant && showSourcesFor === i && (
                      <div className="mt-2 space-y-2 text-xs text-gray-700">
                        {msg.sources!.map((s, idx) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-[#e6dfd3] bg-[#f9f6ef] px-3 py-2"
                          >
                            <strong className="text-emerald-900">
                              {s.reference}
                            </strong>
                            {s.text && (
                              <div className="mt-1 leading-relaxed text-gray-600 italic">
                                {s.text}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {isAssistant && msg.status !== "refusal" && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <button
                          disabled={sending}
                          className="rounded-full bg-[#f0eadf] px-3 py-1 hover:bg-[#e6dfd3] disabled:opacity-50"
                          onClick={() =>
                            sendMessage(
                              "Show the Qur’an and authentic hadith sources for your last answer."
                            )
                          }
                        >
                          Show sources
                        </button>
                        <button
                          disabled={sending}
                          className="rounded-full bg-[#f0eadf] px-3 py-1 hover:bg-[#e6dfd3] disabled:opacity-50"
                          onClick={() => sendMessage("Can you provide more detail?")}
                        >
                          More detail
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Image
                  src="/AALIM.png"
                  alt=""
                  width={75}
                  height={75}
                  className="opacity-70"
                />
                <span className="italic">Aalim is thinking…</span>
              </div>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="mx-6 mb-2 rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700"
            >
              {error}
            </div>
          )}

          <div className="border-t border-[#e6dfd3] bg-[#f9f6ef] p-4">
            <div className="mx-auto flex max-w-3xl gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Aalim..."
                aria-label="Ask Aalim a question"
                className="flex-1 rounded-full border border-[#e6dfd3] bg-white px-5 py-3 text-sm outline-none focus:border-emerald-700 disabled:opacity-60"
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                disabled={sending}
              />
              <button
                onClick={() => sendMessage()}
                disabled={sending || !input.trim()}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-800 transition hover:bg-emerald-900 disabled:opacity-50"
                aria-label="Send message"
              >
                {sending ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                ) : (
                  <Send className="h-6 w-6 text-white" />
                )}
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
