"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mic, Square, Loader2, ArrowLeft } from "lucide-react";
import { WaveformBars } from "@/components/waveform-bars";
import { ConnectionCard } from "@/components/connection-card";
import { LimitModal } from "@/components/limit-modal";
import { mockDb } from "@/lib/mock/db";

type Phase = "idle" | "recording" | "processing" | "transcription" | "structured" | "connection" | "done" | "error";

interface ConnectionData {
  id?: string;
  connection_type: string;
  persona_label?: string | null;
  reason: string;
  action_suggestion: string;
  quality_score: number;
  external_knowledge_title: string | null;
  external_knowledge_url?: string | null;
  external_knowledge_summary?: string | null;
  source_idea_summary?: string | null;
  source_type?: string | null;
}

interface Result {
  transcript?: string;
  structured?: {
    summary: string;
    keywords: string[];
    abstract_principle: string;
    domain: string;
  };
  ideaId?: string;
  error?: string;
}

export default function RecordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<Result>({});
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [showConnectionCount, setShowConnectionCount] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [analyserState, setAnalyserState] = useState<AnalyserNode | null>(null);

  const MAX_DURATION = 60;

  // 自動録音開始（?auto=true）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("auto") === "true") {
      startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // タイマー
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

      // AudioContext + AnalyserNode
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      setAnalyserState(analyser);

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
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        setAnalyserState(null);
        processAudio();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setPhase("recording");
      setElapsed(0);
      setResult({});
      setConnections([]);
      setShowConnectionCount(0);
      setMicError(null);
    } catch {
      setMicError("マイクへのアクセスを許可してください");
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

    // ペルソナ情報を取得
    const personas = mockDb.userSettings.get("mock-user-001")?.personas ?? ["builder"];

    const formData = new FormData();
    formData.append("audio", file);
    formData.append("personas", JSON.stringify(personas));

    let connectionIndex = 0;

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
              break;
            case "connection": {
              setConnections((prev) => [...prev, data]);
              setPhase("connection");
              const idx = connectionIndex;
              const delay = idx === 0 ? 800 : 500;
              setTimeout(() => {
                setShowConnectionCount((c) => Math.max(c, idx + 1));
              }, delay);
              connectionIndex++;
              break;
            }
            case "done":
              setResult((r) => ({ ...r, ideaId: data.idea_id }));
              setPhase("done");
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
  }, []);

  const handleTap = () => {
    if (phase === "idle" || phase === "done" || phase === "error") {
      startRecording();
    } else if (phase === "recording") {
      stopRecording();
    }
  };

  const handleBack = () => {
    if (phase === "recording") {
      if (confirm("録音を中止しますか？")) {
        stopRecording();
        router.push("/");
      }
    } else {
      router.push("/");
    }
  };

  const progress = Math.min(elapsed / MAX_DURATION, 1);
  const dashOffset = 251.2 * (1 - progress);

  const isProcessing = ["processing", "transcription", "structured", "connection", "done"].includes(phase);

  return (
    <main className="flex flex-col min-h-dvh animate-page-enter">
      {/* Header */}
      <header
        className="flex items-center gap-3 px-6 pb-4"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
      >
        <button
          onClick={handleBack}
          className="flex items-center justify-center"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1
          className="text-lg font-light"
          style={{
            fontFamily: "var(--font-noto-serif-jp), 'Noto Serif JP', serif",
            color: "var(--text-primary)",
          }}
        >
          新しいメモ
        </h1>
      </header>

      {/* Results area */}
      {isProcessing && (
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-6">
          {/* 文字起こし */}
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

          {/* 構造化 */}
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

          {/* 接続カード（複数） */}
          {connections.slice(0, showConnectionCount).map((conn, i) => (
            <section key={i} className="animate-page-enter">
              <ConnectionCard
                personaLabel={conn.persona_label}
                connectionType={conn.connection_type}
                reason={conn.reason}
                actionSuggestion={conn.action_suggestion}
                sourceIdeaSummary={conn.source_idea_summary}
                externalTitle={conn.external_knowledge_title}
                externalUrl={conn.external_knowledge_url}
                externalSummary={conn.external_knowledge_summary}
                sourceType={conn.source_type}
                animate={i === 0}
                connectionId={conn.id}
                onDeepDive={() => router.push(`/chat?connection=${conn.id}`)}
              />
            </section>
          ))}

          {/* 処理中インジケーター */}
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
                {phase === "connection" && "繋がりを探索中..."}
              </span>
            </div>
          )}

          {/* エラー */}
          {phase === "error" && (
            <div className="text-center space-y-3">
              <p className="text-sm" style={{ color: "var(--error)" }}>
                {result.error || "処理中にエラーが発生しました"}
              </p>
              {result.error?.includes("上限") ? (
                <button
                  onClick={() => setShowLimitModal(true)}
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{ background: "var(--accent)", color: "#0A0A0A" }}
                >
                  詳細を見る
                </button>
              ) : (
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { setPhase("idle"); setResult({}); startRecording(); }}
                    className="px-4 py-2 rounded-lg text-sm"
                    style={{ background: "var(--accent)", color: "#0A0A0A" }}
                  >
                    もう一度試す
                  </button>
                  <button
                    onClick={() => router.push("/")}
                    className="px-4 py-2 rounded-lg text-sm"
                    style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                  >
                    ホームに戻る
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 完了 */}
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

      {/* 録音エリア */}
      {!isProcessing && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          {/* マイクエラーメッセージ */}
          {micError && (
            <p className="text-sm px-6 text-center" style={{ color: "var(--error)" }}>
              {micError}
            </p>
          )}

          {/* リング + ボタン */}
          <div className="relative">
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

            {phase === "recording" && (
              <div
                className="absolute inset-0 rounded-full animate-pulse-ring"
                style={{ background: "var(--accent)", opacity: 0.3 }}
              />
            )}

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

          {/* 波形 */}
          <WaveformBars analyser={phase === "recording" ? analyserState : null} />

          {/* タイマー */}
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
                style={{ color: "var(--text-muted)" }}
              >
                残り {MAX_DURATION - elapsed}秒
              </p>
            )}
          </div>
        </div>
      )}

      <div className="h-4" />

      <LimitModal open={showLimitModal} onClose={() => setShowLimitModal(false)} />
    </main>
  );
}
