"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Playfair_Display } from "next/font/google";
import { Loader2 } from "lucide-react";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth-context";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["600", "700"] });

const MIN_PASSWORD_LENGTH = 8;

type Mode = "login" | "signup";

export default function AuthForm({ mode }: { mode: Mode }) {
  const isSignup = mode === "signup";
  const router = useRouter();
  const { setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Validated here as well as on the server: the server is the authority,
  // this just avoids a round-trip to say something obvious.
  function clientValidate(): string | null {
    if (!email.trim()) return "Please enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return "Please enter a valid email address.";
    if (!password) return "Please enter your password.";
    if (isSignup && password.length < MIN_PASSWORD_LENGTH)
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const invalid = clientValidate();
    if (invalid) {
      setError(invalid);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const user = isSignup
        ? await api.register(email.trim(), password)
        : await api.login(email.trim(), password);
      setUser(user);
      router.replace("/chat");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("An account with this email already exists. Try logging in.");
      } else {
        setError(
          err instanceof ApiError ? err.message : "Something went wrong."
        );
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="min-app-shell flex flex-col bg-[#f5f1e8] text-gray-900">
      <header className="pt-safe px-safe border-b border-[#e6dfd3] bg-[#f9f6ef] px-4 py-3 sm:px-5 sm:py-4">
        <Link href="/" className="inline-block">
          <Image
            src="/aalimheader.png"
            alt="Aalim"
            width={140}
            height={38}
            priority
            sizes="130px"
            className="h-auto w-[120px] sm:w-[130px]"
          />
        </Link>
      </header>

      <main className="px-safe pb-safe flex flex-1 items-center justify-center px-4 py-8 sm:px-5 sm:py-10">
        <div className="w-full max-w-sm">
          <h1
            className={`${playfair.className} mb-2 text-center text-2xl font-bold text-emerald-950 sm:text-3xl`}
          >
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mb-7 text-center text-sm text-gray-700">
            {isSignup
              ? "Save your conversations and pick up where you left off."
              : "Log in to continue your conversations."}
          </p>

          <form
            onSubmit={onSubmit}
            noValidate
            className="rounded-2xl border border-[#e6dfd3] bg-[#f9f6ef] p-6"
          >
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              placeholder="you@example.com"
              className="mb-4 min-h-12 w-full rounded-full border border-[#e6dfd3] bg-white px-4 text-base text-gray-900 outline-none focus:border-emerald-700 disabled:opacity-60"
            />

            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              enterKeyHint="go"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              placeholder={isSignup ? "At least 8 characters" : "••••••••"}
              className="min-h-12 w-full rounded-full border border-[#e6dfd3] bg-white px-4 text-base text-gray-900 outline-none focus:border-emerald-700 disabled:opacity-60"
            />

            {error && (
              <p
                role="alert"
                aria-live="assertive"
                className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-800 text-sm font-medium text-white transition hover:bg-emerald-900 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting
                ? isSignup
                  ? "Creating account…"
                  : "Logging in…"
                : isSignup
                  ? "Create account"
                  : "Log in"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-gray-700">
            {isSignup ? "Already have an account? " : "New to Aalim? "}
            <Link
              href={isSignup ? "/login" : "/signup"}
              className="font-medium text-emerald-800 underline underline-offset-2"
            >
              {isSignup ? "Log in" : "Create an account"}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
