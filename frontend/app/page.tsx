"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { Playfair_Display } from "next/font/google";
import { useRouter } from "next/navigation";
import { SquarePen, Home as LucideHome, Send } from "lucide-react";
import { PanelLeft } from "lucide-react";
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
});

type Source = {
  type: "quran" | "hadith";
  ref: string;
  text?: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  status?: "ok" | "general" | "refusal";
  sources?: Source[];
};

export default function Home() {
  const [showSourcesFor, setShowSourcesFor] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(true); // ✅ ADDED
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const router = useRouter();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [language, setLanguage] = useState<"en" | "ar" | "ur">("en");
  const LanguageButtons = () => (
    <div className="flex justify-center gap-2 mt-3">
      <button
        onClick={() => setLanguage("en")}
        className={`px-3 py-1 rounded-full text-sm font-medium ${
          language === "en"
            ? "bg-emerald-900 text-white"
            : "bg-[#ebe6dc] text-gray-700"
        }`}
      >
        English
      </button>
  
      <button
        onClick={() => setLanguage("ar")}
        className={`px-3 py-1 rounded-full text-sm font-medium ${
          language === "ar"
            ? "bg-emerald-900 text-white"
            : "bg-[#ebe6dc] text-gray-700"
        }`}
      >
        Arabic
      </button>
  
      <button
        onClick={() => setLanguage("ur")}
        className={`px-3 py-1 rounded-full text-sm font-medium ${
          language === "ur"
            ? "bg-emerald-900 text-white"
            : "bg-[#ebe6dc] text-gray-700"
        }`}
      >
        Urdu
      </button>
    </div>
  );
  useEffect(() => {
    const seen = localStorage.getItem("aalim_intro_seen");
    if (!seen) {
      setShowIntro(true);
    }
    console.log("API URL:", process.env.NEXT_PUBLIC_API_URL);
  }, []);
 
  function startNewChat() {
    setMessages([]);
    setInput("");
    setShowSourcesFor(null);
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const history = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage.content,
          history,language
        }),
      });

      const data = await res.json();

      const aiMessage: Message = {
        role: "assistant",
        content:
          data.answer ||
          data.message ||
          "Unable to answer based on available sources.",
        status: data.status,
        sources: data.sources || [],
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error connecting to Aalim backend.",
          status: "refusal",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function sendQuickMessage(text: string) {
    if (loading) return;
    setInput(text);
    setTimeout(() => {
      sendMessage();
    }, 0);
  }
  const SidebarContent = () => (
    <>
      {/* TOP SECTION */}
      <div>
        <button
          onClick={() => setShowHistory((prev) => !prev)}
          className="flex items-center justify-between w-full font-semibold mb-4 text-emerald-900 text-lg"
        >
          <span>Previous Prompts</span>
          <PanelLeft
            className={`w-6 h-6 transition-transform ${
              showHistory ? "rotate-180" : ""
            }`}
          />
        </button>
  
        {showHistory && (
          <div className="space-y-2">
            {messages
              .filter((m) => m.role === "user")
              .slice(-5)
              .map((m, i) => (
                <div
                  key={i}
                  className="text-xs px-3 py-2 rounded-full bg-[#ebe6dc] text-gray-700 truncate"
                >
                  {m.content}
                </div>
              ))}
          </div>
        )}
      </div>
  
      {/* BOTTOM ACTION BUTTONS */}
      <div className="flex gap-2 pt-4 border-t border-[#e6dfd3]">
        <button
          onClick={() => {
            startNewChat();
            setMobileSidebarOpen(false);
        }}
        className="p-2 rounded-lg hover:bg-[#ebe6dc]"
        >
        <SquarePen className="w-6 h-6 text-emerald-900" />
        </button>
  
        <button
          onClick={() => {
            setMessages([]);
            setInput("");
            setShowIntro(true);
            setMobileSidebarOpen(false);
          }}
          className="p-2 rounded-lg hover:bg-[#ebe6dc]"
        >
          <LucideHome className="w-6 h-6 text-emerald-900" />
        </button>
      </div>
    </>
  );
  return (
    
    <>
      {showIntro && (
        <div className="fixed inset-0 z-50 bg-[#f5f1e8] flex items-center justify-center">
          <div className="max-w-md text-center px-6">
            <Image
              src="/aalimheader.png"
              alt="Aalim"
              width={260}
              height={80}
              className="mx-auto mb-6"
              priority
            />
  
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">
              Welcome to Aalim
            </h1>
  
            <p className="text-sm text-gray-700 mb-4 leading-relaxed">
              Aalim is an AI companion for Muslims, grounded in the Qur’an and
              authentic Sunnah. Ask questions, explore knowledge, and learn your
              deen with clarity and confidence.
            </p>
            <div className="mb-5">
              <LanguageButtons />
            </div>
            <button
              className="w-full rounded-full bg-emerald-800 py-3 text-white text-sm font-medium hover:bg-emerald-900 transition"
              onClick={() => {
                localStorage.setItem("aalim_intro_seen", "true");
                setShowIntro(false);
              }}
            >
              Get Started
            </button>
          </div>
        </div>
      )}
      {mobileSidebarOpen && (
      <div className="fixed inset-0 z-40 md:hidden">
        {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setMobileSidebarOpen(false)}
      />
      {/* Sidebar drawer */}
      <aside className="absolute left-0 top-0 h-full w-64 bg-[#f9f6ef] p-4 flex flex-col justify-between shadow-xl">
        <SidebarContent />
      </aside>
    </div>
  )}
      <div className="flex h-screen bg-[#f5f1e8] text-gray-900">
        {/* ASIDE */}
        <aside className="w-64 border-r border-[#e6dfd3] bg-[#f9f6ef] p-4 hidden md:flex flex-col justify-between">

      {/* TOP SECTION */}
          <SidebarContent />
      </aside>

        {/* MAIN */}
        <main className="flex flex-col flex-1">
          <header className="border-b border-[#e6dfd3] bg-[#f9f6ef] px-6 py-2">
          <div className="absolute left-4 top-4 md:hidden">
            <button
              onClick={() => setMobileSidebarOpen(prev => !prev)}
                className="p-2 rounded-lg hover:bg-[#ebe6dc]"
                aria-label="Open menu"
              >
              <PanelLeft className="w-6 h-6 text-emerald-900" />
            </button>
          </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                <div
                  className="cursor-pointer"
                  onClick={() => {
                    localStorage.removeItem("aalim_intro_seen");
                    setShowIntro(true);
                  }} 
                >
                <Image
                  src="/aalimheader.png"
                  alt="Aalim Logo"
                  width={220}
                  height={60}
                  priority
                />
                </div>
              </div>
  
              <p className="text-sm text-gray-700 text-center leading-tight">
                An AI Companion for Muslims, grounded in Qur’an and authentic Hadith.
                <br />
                Learn your deen with clarity and confidence.
              </p>
              <LanguageButtons />
            </div>
          </header>
  
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg, i) => {
              const isAssistant = msg.role === "assistant";
  
              let badge = null;
              let badgeClass = "";
  
              if (isAssistant) {
                const looksCited =
                  msg.content.includes("Qur’an") ||
                  msg.content.includes("Surah") ||
                  msg.content.includes("Sahih al-Bukhari") ||
                  msg.content.includes("Sahih Muslim") ||
                  msg.content.match(/\d+:\d+/);
  
                if (looksCited) {
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
                      alt="Aalim"
                      width={65}
                      height={65}
                      className="mt-1 opacity-90"
                    />
                  )}
  
                  <div className="max-w-xl space-y-1">
                    {badge && (
                      <div
                        className={`inline-block text-[11px] px-3 py-1 rounded-full font-medium ${badgeClass}`}
                      >
                        {badge}
                      </div>
                    )}
  
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-emerald-800 text-white"
                          : "bg-[#ebe6dc] text-gray-900"
                      }`}
                    >
                      {msg.content}
                    </div>
  
                    {isAssistant && showSourcesFor === i && (
                      <div className="mt-2 text-xs text-gray-700 space-y-1">
                        {msg.sources && msg.sources.length > 0 ? (
                          msg.sources.map((s, idx) => (
                            <div key={idx}>
                              <strong>{s.ref}</strong>
                              {s.text && (
                                <div className="italic text-gray-600">
                                  {s.text}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <p>No explicit sources were cited for this response.</p>
                        )}
                      </div>
                    )}
  
                    {isAssistant && msg.status !== "refusal" && (
                      <div className="flex gap-2 mt-2 text-xs">
                        <button
                          className="px-3 py-1 rounded-full bg-[#f0eadf] hover:bg-[#e6dfd3]"
                          onClick={() =>
                            sendQuickMessage(
                              "Show the Qur’an and authentic hadith sources for your last answer."
                            )
                          }
                        >
                          Show sources
                        </button>
  
                        <button
                          className="px-3 py-1 rounded-full bg-[#f0eadf] hover:bg-[#e6dfd3]"
                          onClick={() =>
                            sendQuickMessage("Can you provide more detail?")
                          }
                        >
                          More detail
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
  
            {loading && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <Image
                  src="/AALIM.png"
                  alt="Aalim"
                  width={75}
                  height={75}
                  className="opacity-70"
                />
                <span className="italic">Aalim is thinking…</span>
              </div>
            )}
          </div>
  
          <div className="border-t border-[#e6dfd3] bg-[#f9f6ef] p-4">
            <div className="flex gap-3 max-w-3xl mx-auto">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Aalim..."
                className="flex-1 rounded-full border px-5 py-3 text-sm"
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                className="flex items-center justify-center rounded-full bg-emerald-800 w-14 h-14 hover:bg-emerald-900 transition"
                aria-label="Send message"
              > 
              <Send className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}