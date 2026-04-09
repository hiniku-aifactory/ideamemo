"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mic, Square, Loader2 } from "lucide-react";
import { WaveformBars } from "@/components/waveform-bars";
import { ConnectionCard } from "@/components/connection-card";

type Phase = "idle" | "recording" | "processing" | "transcription" | "structured" | "connection" | "done" | "error";

interface Result {
  transcript?: string;
  structured?: {
    summary: string;
    keywords: string[];
    abstract_principle: string;
    domain: string;
  };
  connection?: {
    connection_type: string;
    reason: string;
    action_suggestion: string;
    quality_score: number;
    external_knowledge_title: string | null;
  };
  ideaId?: string;
  error?: string;
}

export default function RecordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<Result>({});
  const [showConnection, setShowConnection] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);

  const MAX_DURATION = 60; // 1 minute

  // Timer
  useEffect(() => {
    if (phase === "recording") {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(s);
        if (s >= MAX_DURATION) stopRecording();
      }, 200);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        processAudio();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setPhase("recording");
      setElapsed(0);
      setResult({});
      setShowConnection(false);
    } catch {
      alert("マイクへのアクセスを許可してください");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("processing");
  }, []);

  const processAudio = useCallback(async () => {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const file = new File([blob], "recording.webm", { type: blob.type });

    const formData = new FormData();
    formData.append("audio", file);

    try {
      const response = await fetch("/api/ideas", { method: "POST", body: formData });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const raw of events) {
          const eventMatch = raw.match(/event: (\w+)/);
          const dataMatch = raw.match(/data: ([\s\S]+)/);
          if (!eventMatch || !dataMatch) continue;

          const event = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          switch (event) {
            case "transcription":
              setResult((r) => ({ ...r, transcript: data.transcript }));
              setPhase("transcription");
              break;
            case "structured":
              setResult((r) => ({ ...r, structured: data }));
              setPhase("structured");
              // 0.8s intentional delay before showing connection (Wow Moment §7-1)
              break;
            case "connection":
              setResult((r) => ({ ...r, connection: data }));
              setPhase("connection");
              setTimeout(() => setShowConnection(true), 800);
              break;
            case "done":
              setResult((r) => ({ ...r, ideaId: data.idea_id }));
              setPhase("done");
              if (!result.connection) setShowConnection(false);
              break;
            case "error":
              setResult((r) => ({ ...r, error: data.message }));
              setPhase("error");
              break;
          }
        }
      }
    } catch (err) {
      console.error("SSE error:", err);
      setResult((r) => ({ ...r, error: "通信エラーが発生しました" }));
      setPhase("error");
    }
  }, [result.connection]);

  const handleTap = () => {
    if (phase === "idle" || phase === "done" || phase === "error") {
      startRecording();
    } else if (phase === "recording") {
      stopRecording();
    }
  };

  const progress = Math.min(elapsed / MAX_DURATION, 1);
  const dashOffset = 251.2 * (1 - progress); // circumference = 2π*40 ≈ 251.2

  const isProcessing = ["processing", "transcription", "structured", "connection", "done"].includes(phase);

  return (
    <main className="flex flex-col min-h-dvh animate-page-enter">
      {/* Header */}
      <header className="px-6 pt-12 pb-4">
        <h1
          className="text-2xl font-light"
          style={{
            fontFamily: "var(--font-noto-serif-jp), 'Noto Serif JP', serif",
            color: "var(--text-primary)",
          }}
        >
          新しいメモ
        </h1>
      </header>

      {/* Results area (scrollable) */}
      {isProcessing && (
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-6">
          {/* Transcription */}
          {result.transcript && (
            <section className="animate-page-enter">
              <p className="text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>
                聞き取れた内容
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)", lineHeight: 1.7 }}>
                {result.transcript}
              </p>
            </section>
          )}

          {/* Structured */}
          {result.structured && (
            <section className="animate-page-enter">
              <p
                className="text-base font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {result.structured.summary}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {result.structured.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-[11px] px-2 py-0.5 rounded-full"
                    style={{ background: "var(--accent)", color: "#0A0A0A" }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
              <p
                className="mt-2 text-sm italic"
                style={{ color: "var(--text-secondary)" }}
              >
                {result.structured.abstract_principle}
              </p>
            </section>
          )}

          {/* Connection Card */}
          {result.connection && showConnection && (
            <section className="animate-page-enter">
              <ConnectionCard
                connectionType={result.connection.connection_type}
                reason={result.connection.reason}
                actionSuggestion={result.connection.action_suggestion}
                externalTitle={result.connection.external_knowledge_title}
                animate
              />
            </section>
          )}

          {/* Processing indicator */}
          {phase !== "done" && phase !== "error" && (
            <div className="flex items-center gap-2">
              <Loader2
                size={14}
                className="animate-spin"
                style={{ color: "var(--accent-dim)" }}
              />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {phase === "processing" && "文字起こし中..."}
                {phase === "transcription" && "構造化中..."}
                {phase === "structured" && "繋がりを探索中..."}
                {phase === "connection" && "完了..."}
              </span>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <p className="text-sm" style={{ color: "var(--error)" }}>
              {result.error || "エラーが発生しました"}
            </p>
          )}

          {/* Done — Go home */}
          {phase === "done" && (
            <button
              onClick={() => router.push("/")}
              className="w-full rounded-xl py-3 text-sm font-medium"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
            >
              ホームに戻る
            </button>
          )}
        </div>
      )}

      {/* Recording area (centered when not processing) */}
      {!isProcessing && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          {/* Ring progress + FAB */}
          <div className="relative">
            {/* SVG Ring */}
            <svg width="96" height="96" className="absolute -top-4 -left-4">
              <circle
                cx="48"
                cy="48"
                r="40"
                fill="none"
                stroke="var(--border)"
                strokeWidth="2"
              />
              {phase === "recording" && (
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="251.2"
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 48 48)"
                  style={{ transition: "stroke-dashoffset 0.3s ease-out" }}
                />
              )}
            </svg>

            {/* Pulse ring */}
            {phase === "recording" && (
              <div
                className="absolute inset-0 rounded-full animate-pulse-ring"
                style={{ background: "var(--accent)", opacity: 0.3 }}
              />
            )}

            {/* Button */}
            <button
              onClick={handleTap}
              className="relative w-16 h-16 rounded-full flex items-center justify-center transition-colors z-10"
              style={{
                background: phase === "recording" ? "var(--accent)" : "var(--accent-dim)",
              }}
            >
              {phase === "recording" ? (
                <Square size={20} style={{ color: "var(--text-primary)" }} />
              ) : (
                <Mic size={24} style={{ color: "var(--text-primary)" }} />
              )}
            </button>
          </div>

          {/* Waveform */}
          <WaveformBars active={phase === "recording"} />

          {/* Timer */}
          <div className="text-center">
            <p
              className="text-sm tabular-nums"
              style={{
                fontFamily: "var(--font-jetbrains-mono), 'JetBrains Mono', monospace",
                color: "var(--text-muted)",
              }}
            >
              {String(Math.floor(elapsed / 60)).padStart(1, "0")}:
              {String(elapsed % 60).padStart(2, "0")}
            </p>
            {phase === "recording" && (
              <p
                className="text-[11px] mt-1"
                style={{ color: "#2A2725" }}
              >
                残り {MAX_DURATION - elapsed}秒
              </p>
            )}
          </div>
        </div>
      )}

      {/* Spacer for tab bar */}
      <div className="h-20" />
    </main>
  );
}
