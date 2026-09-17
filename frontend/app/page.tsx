"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Playfair_Display } from "next/font/google";
import { BookOpen, ShieldCheck, MessagesSquare } from "lucide-react";
import { useAuth } from "../lib/auth-context";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const FEATURES = [
  {
    icon: BookOpen,
    title: "Grounded in source texts",
    body: "Answers are retrieved from the Qur’an, Sahih al-Bukhari, and Sahih Muslim — and every citation is shown to you.",
  },
  {
    icon: ShieldCheck,
    title: "Evidence over opinion",
    body: "Aalim explains what the texts say. It does not issue rulings, fatwas, or speculative theology.",
  },
  {
    icon: MessagesSquare,
    title: "Your conversations, saved",
    body: "Pick up where you left off. Your chat history is private to your account.",
  },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Someone already signed in has no use for the marketing page.
  useEffect(() => {
    if (!loading && user) router.replace("/chat");
  }, [loading, user, router]);

  return (
    <div className="min-app-shell bg-[#f5f1e8] text-gray-900">
      <header className="pt-safe border-b border-[#e6dfd3] bg-[#f9f6ef]">
        <div className="px-safe mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
          <Image
            src="/aalimheader.png"
            alt="Aalim"
            width={150}
            height={40}
            priority
            sizes="(max-width: 640px) 110px, 150px"
            className="h-auto w-[110px] sm:w-[150px]"
          />
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-emerald-900 hover:bg-[#ebe6dc] sm:px-4"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center rounded-full bg-emerald-800 px-3.5 text-sm font-medium text-white transition hover:bg-emerald-900 sm:px-4"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main className="px-safe mx-auto max-w-5xl px-4 sm:px-5">
        <section className="flex flex-col items-center py-10 text-center sm:py-20">
          <Image
            src="/AALIM.png"
            alt=""
            width={96}
            height={96}
            priority
            sizes="96px"
            className="mb-5 h-16 w-16 opacity-90 sm:mb-6 sm:h-24 sm:w-24"
          />

          <h1
            className={`${playfair.className} max-w-2xl text-[1.75rem] leading-tight font-bold text-emerald-950 sm:text-5xl`}
          >
            Learn your deen with clarity and confidence
          </h1>

          <p className="mt-5 max-w-xl text-sm leading-relaxed text-gray-700 sm:text-base">
            Aalim is an AI companion for Muslims, grounded in the Qur’an and
            authentic Sunnah. Ask a question and see the verses and hadith
            behind every answer.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-800 px-7 text-sm font-medium text-white transition hover:bg-emerald-900"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#e6dfd3] bg-[#f9f6ef] px-7 text-sm font-medium text-emerald-900 transition hover:bg-[#ebe6dc]"
            >
              Log in
            </Link>
          </div>

          <p className="mt-4 text-xs text-gray-500">
            Free to use. Your conversations stay private to your account.
          </p>
        </section>

        <section className="grid gap-3 pb-10 sm:grid-cols-3 sm:gap-4 sm:pb-16">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-[#e6dfd3] bg-[#f9f6ef] p-5"
            >
              <Icon className="mb-3 h-6 w-6 text-emerald-800" />
              <h2 className="mb-1.5 text-sm font-semibold text-emerald-950">
                {title}
              </h2>
              <p className="text-xs leading-relaxed text-gray-700">{body}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto mb-16 max-w-2xl rounded-2xl border border-[#e6dfd3] bg-[#ebe6dc]/50 p-5 text-center">
          <p className="text-xs leading-relaxed text-gray-700">
            Aalim draws only on the Qur’an, Sahih al-Bukhari, and Sahih Muslim.
            It is a study aid, not a substitute for a qualified scholar, and it
            will decline questions that call for a ruling.
          </p>
        </section>
      </main>

      <footer className="pb-safe border-t border-[#e6dfd3] bg-[#f9f6ef] py-6">
        <p className="text-center text-xs text-gray-500">
          Aalim — grounded in Qur’an and authentic Hadith.
        </p>
      </footer>
    </div>
  );
}
