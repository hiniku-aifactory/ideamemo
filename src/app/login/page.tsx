"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import { getRandomQuote } from "@/lib/quotes";

export default function LoginPage() {
  const { signInWithGoogle, signInWithMagicLink } = useAuth();
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const quote = useMemo(() => getRandomQuote(), []);

  async function handleGoogle() {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      setError("ログインに失敗しました");
      setLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    const result = await signInWithMagicLink(email);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setEmailSent(true);
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col min-h-dvh px-8 animate-page-enter">
      {/* Upper 40% — Quote */}
      <div className="flex-[4] flex flex-col justify-end pb-8">
        <p
          className="text-lg italic leading-relaxed"
          style={{
            color: "var(--text-secondary)",
            fontFamily: "var(--font-eb-garamond), 'EB Garamond', serif",
          }}
        >
          &ldquo;{quote.text}&rdquo;
        </p>
        <p
          className="mt-2 text-sm"
          style={{
            color: "var(--text-muted)",
            fontFamily: "var(--font-eb-garamond), 'EB Garamond', serif",
          }}
        >
          — {quote.author}
        </p>
      </div>

      {/* Center — Brand */}
      <div className="flex-[3] flex flex-col justify-center items-center">
        <h1
          className="text-[32px] font-light tracking-wide"
          style={{
            color: "var(--text-primary)",
            fontFamily: "var(--font-noto-serif-jp), 'Noto Serif JP', serif",
          }}
        >
          ideamemo
        </h1>
        <p
          className="mt-3 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          声で種を蒔く。つながりが芽を出す。
        </p>
      </div>

      {/* Lower 30% — Auth buttons */}
      <div className="flex-[3] flex flex-col items-center pt-4">
        {!showEmail && !emailSent && (
          <>
            {/* Google Sign In — P2: 暗闇の中の一点 (white button on dark bg) */}
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full max-w-xs flex items-center justify-center gap-3 rounded-xl px-6 py-3.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: "#ffffff",
                color: "#1A1714",
              }}
            >
              <GoogleIcon />
              Google でログイン
            </button>

            <button
              onClick={() => setShowEmail(true)}
              className="mt-4 text-sm transition-opacity hover:opacity-80"
              style={{ color: "var(--text-secondary)" }}
            >
              メールアドレスでログイン
            </button>
          </>
        )}

        {showEmail && !emailSent && (
          <form onSubmit={handleMagicLink} className="w-full max-w-xs space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="メールアドレス"
              autoFocus
              className="w-full rounded-xl px-4 py-3 text-sm outline-none placeholder:opacity-40"
              style={{
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            />
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full rounded-xl px-6 py-3 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                background: "var(--accent)",
                color: "#0A0A0A",
              }}
            >
              {loading ? "送信中..." : "ログインリンクを送信"}
            </button>
            <button
              type="button"
              onClick={() => setShowEmail(false)}
              className="w-full text-sm transition-opacity hover:opacity-80"
              style={{ color: "var(--text-muted)" }}
            >
              戻る
            </button>
          </form>
        )}

        {emailSent && (
          <div className="text-center">
            <p className="text-sm" style={{ color: "var(--text-primary)" }}>
              メールを確認してください
            </p>
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              {email} にログインリンクを送信しました
            </p>
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs" style={{ color: "var(--error)" }}>
            {error}
          </p>
        )}

        {/* Terms */}
        <p
          className="mt-auto pb-8 text-center text-[11px] leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          ログインすることで
          <a href="/terms" className="underline">利用規約</a>
          と
          <a href="/privacy" className="underline">プライバシーポリシー</a>
          に同意したことになります
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
