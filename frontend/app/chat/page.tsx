"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  Loader2,
  Menu,
  Send,
  WifiOff,
} from "lucide-react";
import {
  ApiError,
  ConversationSummary,
  MAX_HISTORY_MESSAGES,
  Source,
  api,
} from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import {
  useDraft,
  useLastConversation,
  useOnlineStatus,
  useStickyScroll,
  useVisualViewportHeight,
} from "../../lib/hooks";
import { isRtl } from "../../lib/text";
import ConversationSidebar from "../../components/ConversationSidebar";
import MessageContent from "../../components/MessageContent";
import MobileDrawer from "../../components/MobileDrawer";

type Message = {
  role: "user" | "assistant";
  content: string;
  status?: "ok" | "general" | "refusal" | null;
  sources?: Source[];
};

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ar", label: "Arabic" },
  { code: "ur", label: "Urdu" },
] as const;

type LanguageCode = (typeof LANGUAGES)[number]["code"];

export default function ChatPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const online = useOnlineStatus();
  useVisualViewportHeight();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingConvo, setLoadingConvo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSources, setOpenSources] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>("en");

  const { read: readLastConvo, write: writeLastConvo } = useLastConversation(
    user?.id
  );
  const draftKey = user ? `${user.id}_${conversationId ?? "new"}` : null;
  const { value: input, setValue: setInput, clear: clearDraft } =
    useDraft(draftKey);

  const { ref: scrollRef, onScroll, pinned, scrollToBottom } =
    useStickyScroll<HTMLDivElement>([messages.length, sending]);

  const inputRef = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    // Skipped during an intentional logout: clearing the user would
    // otherwise trip this guard and send the visitor to /login, racing
    // the deliberate navigation back to the landing page.
    if (loggingOutRef.current) return;
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await api.listConversations());
    } catch {
      /* the sidebar is non-critical; chatting still works */
    } finally {
      setLoadingList(false);
    }
  }, []);

  const openConversation = useCallback(
    async (id: number, { silent = false } = {}) => {
      setDrawerOpen(false);
      setLoadingConvo(true);
      setError(null);
      try {
        const detail = await api.getConversation(id);
        setConversationId(detail.id);
        writeLastConvo(detail.id);
        setMessages(
          detail.messages.map((m) => ({
            role: m.role,
            content: m.content,
            status: m.status,
            sources: m.sources,
          }))
        );
        setOpenSources(null);
      } catch (err) {
        // A remembered conversation may have been deleted, or belong to a
        // different account on a shared device. Forget it quietly.
        writeLastConvo(null);
        if (!silent) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Could not open that conversation."
          );
        }
      } finally {
        setLoadingConvo(false);
      }
    },
    [writeLastConvo]
  );

  useEffect(() => {
    if (!user) return;
    loadConversations();
  }, [user, loadConversations]);

  // Restore the conversation that was open before the reload, once.
  useEffect(() => {
    if (!user || restoredRef.current) return;
    restoredRef.current = true;
    const last = readLastConvo();
    if (last) openConversation(last, { silent: true });
  }, [user, readLastConvo, openConversation]);

  function startNewChat() {
    // The row is created lazily by the first question, so a new chat
    // costs nothing until something is actually asked.
    setConversationId(null);
    setMessages([]);
    setOpenSources(null);
    setError(null);
    setDrawerOpen(false);
    writeLastConvo(null);
    inputRef.current?.focus();
  }

  async function removeConversation(id: number) {
    try {
      await api.deleteConversation(id);
      if (id === conversationId) startNewChat();
      loadConversations();
    } catch {
      setError("Could not delete that conversation.");
    }
  }

  async function sendMessage(text?: string) {
    const question = (text ?? input).trim();
    if (!question || sending) return;

    if (!online) {
      setError("You're offline. Reconnect to ask Aalim a question.");
      return;
    }

    const outgoing: Message = { role: "user", content: question };
    const updated = [...messages, outgoing];
    setMessages(updated);
    clearDraft();
    setSending(true);
    setError(null);
    scrollToBottom();

    try {
      const data = await api.ask({
        question,
        // Prior turns only — the current question travels in `question`.
        // Including it here made the server's "show me the sources"
        // handling resolve back to the quick-action text itself instead
        // of the question it was meant to re-run.
        // Trimmed to the server's cap: sending more is a 422, which broke
        // every conversation past ten exchanges.
        history: messages
          .slice(-MAX_HISTORY_MESSAGES)
          .map((m) => ({ role: m.role, content: m.content })),
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
        writeLastConvo(data.conversation_id);
      }
      loadConversations();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      // Roll the optimistic message back and hand the text to the
      // composer so nothing the user typed is lost.
      setMessages((prev) => prev.slice(0, -1));
      setInput(question);
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reach Aalim. Check your connection and try again."
      );
    } finally {
      setSending(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="app-shell flex items-center justify-center bg-[#f5f1e8]">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-800" />
        <span className="sr-only">Loading your account…</span>
      </div>
    );
  }

  const sidebar = (
    <ConversationSidebar
      conversations={conversations}
      activeId={conversationId}
      loading={loadingList}
      userEmail={user.email}
      onOpen={(id) => openConversation(id)}
      onNew={startNewChat}
      onDelete={removeConversation}
      onLogout={async () => {
        loggingOutRef.current = true;
        await logout();
        router.replace("/");
      }}
    />
  );

  return (
    <div className="app-shell flex bg-[#f5f1e8] text-gray-900">
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Menu"
      >
        {sidebar}
      </MobileDrawer>

      {/* Desktop sidebar — unchanged behaviour, now a shared component. */}
      <aside className="pt-safe pb-safe hidden w-72 shrink-0 flex-col border-r border-[#e6dfd3] bg-[#f9f6ef] p-4 md:flex">
        {sidebar}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="chat-header pt-safe shrink-0 border-b border-[#e6dfd3] bg-[#f9f6ef]">
          <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-emerald-900 hover:bg-[#ebe6dc] md:hidden"
              aria-label="Open menu"
              aria-expanded={drawerOpen}
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>

            <div className="flex min-w-0 flex-1 justify-center">
              <Image
                src="/aalimheader.png"
                alt="Aalim"
                width={220}
                height={60}
                priority
                sizes="(max-width: 640px) 140px, 220px"
                className="chat-logo h-auto w-[130px] sm:w-[180px] lg:w-[220px]"
              />
            </div>

            {/* Balances the menu button so the logo stays centred. */}
            <div className="h-11 w-11 shrink-0 md:hidden" aria-hidden="true" />
          </div>

          <div className="lang-row flex flex-wrap items-center justify-center gap-1.5 px-3 pb-2">
            {LANGUAGES.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setLanguage(code)}
                aria-pressed={language === code}
                className={`lang-btn min-h-9 rounded-full px-3.5 text-xs font-medium transition ${
                  language === code
                    ? "bg-emerald-900 text-white"
                    : "bg-[#ebe6dc] text-gray-700 hover:bg-[#e6dfd3]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {!online && (
          <div
            role="status"
            className="flex shrink-0 items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-xs text-amber-900"
          >
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            You&rsquo;re offline — Aalim needs a connection to answer.
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="scroll-area absolute inset-0 space-y-5 px-3 py-4 sm:px-6 sm:py-6"
          >
            {loadingConvo && (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-800" />
                <span className="sr-only">Loading conversation…</span>
              </div>
            )}

            {!loadingConvo && messages.length === 0 && (
              <div className="mx-auto max-w-sm px-2 pt-8 text-center sm:pt-14">
                <Image
                  src="/AALIM.png"
                  alt=""
                  width={72}
                  height={72}
                  sizes="72px"
                  className="mx-auto mb-4 h-16 w-16 opacity-80 sm:h-18 sm:w-18"
                />
                <p className="text-sm leading-relaxed text-gray-600">
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
                  badgeClass = "bg-[#e8dcc7] text-gray-900";
                } else if (msg.status === "refusal") {
                  badge = "🚫 Unable to answer";
                  badgeClass = "bg-gray-200 text-gray-900";
                }
              }

              return (
                <div
                  key={i}
                  className={`flex items-start gap-2 sm:gap-3 ${
                    isAssistant ? "justify-start" : "justify-end"
                  }`}
                >
                  {isAssistant && (
                    <Image
                      src="/AALIM.png"
                      alt=""
                      width={44}
                      height={44}
                      sizes="44px"
                      className="mt-1 hidden h-11 w-11 shrink-0 opacity-90 sm:block"
                    />
                  )}

                  <div className="min-w-0 max-w-[85%] space-y-1.5 sm:max-w-xl">
                    {badge && (
                      <div
                        className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${badgeClass}`}
                      >
                        {badge}
                      </div>
                    )}

                    <MessageContent
                      content={msg.content}
                      className={`rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed sm:px-4 sm:py-3 ${
                        isAssistant
                          ? "bg-[#ebe6dc] text-gray-900"
                          : "bg-emerald-800 text-white"
                      }`}
                    />

                    {isAssistant && (msg.sources?.length ?? 0) > 0 && (
                      <>
                        <button
                          onClick={() =>
                            setOpenSources(openSources === i ? null : i)
                          }
                          aria-expanded={openSources === i}
                          className="min-h-9 rounded-full bg-[#f0eadf] px-3 text-xs text-gray-800 hover:bg-[#e6dfd3]"
                        >
                          {openSources === i ? "Hide" : "Show"}{" "}
                          {msg.sources!.length} source
                          {msg.sources!.length === 1 ? "" : "s"}
                        </button>

                        {openSources === i && (
                          <ul className="space-y-2 text-xs text-gray-700">
                            {msg.sources!.map((s, idx) => {
                              const srtl = isRtl(s.text);
                              return (
                                <li
                                  key={idx}
                                  className="rounded-xl border border-[#e6dfd3] bg-[#f9f6ef] px-3 py-2"
                                >
                                  <strong className="text-emerald-900">
                                    {s.reference}
                                  </strong>
                                  {s.text && (
                                    <div
                                      dir={srtl ? "rtl" : "ltr"}
                                      className="msg mt-1 leading-relaxed text-gray-600 italic"
                                    >
                                      {s.text}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    )}

                    {isAssistant && msg.status !== "refusal" && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        <button
                          disabled={sending}
                          onClick={() =>
                            sendMessage(
                              "Show the Qur’an and authentic hadith sources for your last answer."
                            )
                          }
                          className="min-h-9 rounded-full bg-[#f0eadf] px-3 text-xs text-gray-800 hover:bg-[#e6dfd3] disabled:opacity-50"
                        >
                          Show sources
                        </button>
                        <button
                          disabled={sending}
                          onClick={() => sendMessage("Can you provide more detail?")}
                          className="min-h-9 rounded-full bg-[#f0eadf] px-3 text-xs text-gray-800 hover:bg-[#e6dfd3] disabled:opacity-50"
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
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Image
                  src="/AALIM.png"
                  alt=""
                  width={44}
                  height={44}
                  sizes="44px"
                  className="h-11 w-11 opacity-70"
                />
                <span className="italic">Aalim is thinking…</span>
              </div>
            )}
          </div>

          {/* Appears only when the reader has scrolled away from the end. */}
          {!pinned && messages.length > 0 && (
            <button
              onClick={() => scrollToBottom()}
              aria-label="Scroll to latest message"
              className="absolute bottom-3 left-1/2 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-[#e6dfd3] bg-[#f9f6ef] shadow-md"
            >
              <ArrowDown className="h-5 w-5 text-emerald-900" aria-hidden="true" />
            </button>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mx-3 mb-2 shrink-0 rounded-xl bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800 sm:mx-6"
          >
            {error}
          </div>
        )}

        <div className="pb-safe shrink-0 border-t border-[#e6dfd3] bg-[#f9f6ef]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="mx-auto flex max-w-3xl items-end gap-2 px-3 py-3 sm:px-4"
          >
            <label htmlFor="composer" className="sr-only">
              Ask Aalim a question
            </label>
            <input
              id="composer"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Aalim..."
              enterKeyHint="send"
              autoComplete="off"
              disabled={sending}
              /* 16px minimum: anything smaller makes iOS Safari zoom the
                 page when the field receives focus. */
              className="min-h-11 min-w-0 flex-1 rounded-full border border-[#e6dfd3] bg-white px-4 text-base text-gray-900 outline-none focus:border-emerald-700 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-white transition hover:bg-emerald-900 disabled:opacity-50 sm:h-12 sm:w-12"
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
