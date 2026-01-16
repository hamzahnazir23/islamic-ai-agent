"use client";
import Image from "next/image";
import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  status?: "ok" | "general" | "refusal";
};

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

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

      const res = await fetch("http://127.0.0.1:8000/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMessage.content,
          history,
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
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error connecting to MuftiGPT backend.",
          status: "refusal",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // ✅ ADDITION (assistive helper – no existing code changed)
  function sendQuickMessage(text: string) {
    if (loading) return;
    setInput(text);
    setTimeout(() => {
      sendMessage();
    }, 0);
  }

  return (
    <div className="flex h-screen bg-[#f5f1e8] text-gray-900">
      <aside className="w-64 border-r border-[#e6dfd3] bg-[#f9f6ef] p-4 hidden md:block">
        <h2 className="font-semibold mb-4 text-emerald-900">
          Previous Prompts
        </h2>

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
      </aside>

      <main className="flex flex-col flex-1">
        <header className="border-b border-[#e6dfd3] bg-[#f9f6ef] px-6 py-6 text-center">
          <div className="flex items-center justify-center gap-3">
            <Image
              src="/MuftiGPT_LogoTransparent.png"
              alt="MuftiGPT Logo"
              width={42}
              height={42}
              priority
            />
            <h1 className="text-4xl font-extrabold text-emerald-900">
              MuftiGPT
            </h1>
          </div>

          <p className="mt-3 text-sm text-gray-700 max-w-xl mx-auto">
            Your Personal Islamic AI Friend, providing evidence-based answers
            from the Qur’an and Sahih Hadith
          </p>
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
              msg.content.match(/\d+:\d+/); // catches 2:153 etc.
            
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
                    src="/MuftiGPT_LogoTransparent.png"
                    alt="MuftiGPT"
                    width={28}
                    height={28}
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

                  {/* ✅ ASSISTIVE SUGGESTIONS (ONLY ADDITION HERE) */}
                  {isAssistant && msg.status !== "refusal" && (
                    <div className="flex gap-2 mt-2 text-xs">
                      <button
                        className="px-3 py-1 rounded-full bg-[#f0eadf] hover:bg-[#e6dfd3]"
                        onClick={() =>
                          sendQuickMessage("Can you show the exact sources?")
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

                      <button
                        className="px-3 py-1 rounded-full bg-[#f0eadf] hover:bg-[#e6dfd3]"
                        onClick={() =>
                          sendQuickMessage(
                            "Is there a specific verse about this?"
                          )
                        }
                      >
                        Specific verse
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Image
                src="/MuftiGPT_LogoTransparent.png"
                alt="MuftiGPT"
                width={24}
                height={24}
                className="opacity-70"
              />
              <span className="italic">MuftiGPT is thinking…</span>
            </div>
          )}
        </div>

        <div className="border-t border-[#e6dfd3] bg-[#f9f6ef] p-4">
          <div className="flex gap-3 max-w-3xl mx-auto">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask MuftiGPT…"
              className="flex-1 rounded-full border px-5 py-3 text-sm"
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading}
              className="rounded-full bg-emerald-800 px-6 py-3 text-sm text-white"
            >
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}