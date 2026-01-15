"use client";
import Image from "next/image";
import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: userMessage.content }),
      });

      const data = await res.json();

      const aiMessage: Message = {
        role: "assistant",
        content:
          data.status === "ok"
            ? data.answer
            : data.message || "Unable to answer based on available sources.",
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error connecting to MuftiGPT backend.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen bg-[#f5f1e8] text-gray-900">
      {/* SIDEBAR */}
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

      {/* MAIN CHAT */}
      <main className="flex flex-col flex-1">
        {/* HEADER */}
        <header className="border-b border-[#e6dfd3] bg-[#f9f6ef] px-6 py-6 text-center">
          <div className="flex items-center justify-center gap-3">
            <Image
              src="/MuftiGPT_LogoTransparent.png"
              alt="MuftiGPT Logo"
              width={42}
              height={42}
              priority
              className="drop-shadow-sm"
            />
            <h1 className="text-4xl font-extrabold tracking-tight text-emerald-900">
              MuftiGPT
            </h1>
          </div>

          <p className="mt-3 text-sm text-gray-700 max-w-xl mx-auto">
            Your Personal Islamic AI Friend, providing evidence-based answers
            from the Qur’an and Sahih Hadith
          </p>
        </header>

        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <Image
                  src="/MuftiGPT_LogoTransparent.png"
                  alt="MuftiGPT"
                  width={28}
                  height={28}
                  className="mt-1 opacity-90"
                />
              )}

              <div
                className={`max-w-xl px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-emerald-800 text-white"
                    : "bg-[#ebe6dc] text-gray-900"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

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

        {/* INPUT */}
        <div className="border-t border-[#e6dfd3] bg-[#f9f6ef] p-4">
          <div className="flex gap-3 max-w-3xl mx-auto">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask MuftiGPT…"
              className="flex-1 rounded-full border border-[#d8cfbf] px-5 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading}
              className="rounded-full bg-emerald-800 px-6 py-3 text-sm text-white hover:bg-emerald-900 transition disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}