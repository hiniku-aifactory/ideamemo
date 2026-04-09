"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { useRecording } from "@/components/recording-context";
import { WaveformBars } from "@/components/waveform-bars";
import { KnowledgeCard, LatentQuestionHeader } from "@/components/knowledge-card";
import { LimitModal } from "@/components/limit-modal";
import { mockDb } from "@/lib/mock/db";

type Phase = "idle" | "recording" | "processing" | "transcription" | "structured" | "connection" | "done" | "error";

interface ConnectionData {
  id?: string;
  title: string;
  description: string;
  source_url?: string | null;
  source_title?: string | null;
  quality_score?: number;
  bookmarked?: boolean;
}

interface Result {
  transcript?: string;
  structured?: {
    summary: string;
    keywords: string[];
    abstract_principle: string;
    domain: string;
    latent_question?: string;
  };
  ideaId?: string;
  error?: string;
}

export default function RecordPage() {
  const router = useRouter();
  const { setRecording: setGlobalRecording, setOnStopRequested } = useRecording();
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

  // 自動録音開始
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
      setGlobalRecording(true);
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
    setGlobalRecording(false);
    setOnStopRequested(null);
  }, [setGlobalRecording, setOnStopRequested]);

  // 録音中はタブバーの停止ボタンと連携
  const stopRecordingRef = useRef(stopRecording);
  stopRecordingRef.current = stopRecording;
  useEffect(() => {
    if (phase === "recording") {
      setOnStopRequested(() => () => stopRecordingRef.current());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const processAudio = useCallback(async () => {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const file = new File([blob], "recording.webm", { type: blob.type });
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
      setResult((r) => ({ ...r, error: "通信エラー" }));
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
      if (confirm("録音を中止しますか?")) {
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
      <AppHeader showBack />

      {/* 処理結果エリア */}
      {isProcessing && (
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5">
          {/* 文字起こし: ラベルなし、テキストのみ */}
          {result.transcript && (
            <section className="animate-page-enter">
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: "var(--text-primary)", lineHeight: 1.8 }}
              >
                {result.transcript}
              </p>
            </section>
          )}

          {/* 構造化 */}
          {result.structured && (
            <section className="animate-page-enter">
              <p
                className="text-[15px] font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {result.structured.summary}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {result.structured.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-[10px] px-2 py-0.5 rounded"
                    style={{
                      border: "0.5px solid var(--border)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
              {result.structured.abstract_principle && (
                <p
                  className="mt-2 text-[13px] italic"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {result.structured.abstract_principle}
                </p>
              )}
            </section>
          )}

          {/* latent_question + 外部知識カード */}
          {showConnectionCount > 0 && (
            <section className="animate-page-enter">
              {result.structured?.latent_question && (
                <LatentQuestionHeader question={result.structured.latent_question} />
              )}
              {connections.slice(0, showConnectionCount).map((conn, i) => (
                <KnowledgeCard
                  key={i}
                  title={conn.title}
                  description={conn.description}
                  sourceUrl={conn.source_url}
                  sourceTitle={conn.source_title}
                  bookmarked={conn.bookmarked ?? false}
                  onBookmark={() => {
                    if (conn.id) {
                      fetch(`/api/connections/${conn.id}/bookmark`, { method: "POST" });
                    }
                  }}
                />
              ))}
            </section>
          )}

          {/* 処理中インジケーター */}
          {phase !== "done" && phase !== "error" && (
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full border border-t-transparent animate-spin"
                style={{ borderColor: "var(--border)", borderTopColor: "transparent" }}
              />
              <span
                className="text-[11px]"
                style={{
                  color: "var(--text-muted)",
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                }}
              >
                {phase === "processing" && "transcribing"}
                {phase === "transcription" && "structuring"}
                {phase === "structured" && "searching"}
                {phase === "connection" && "searching"}
              </span>
            </div>
          )}

          {/* エラー */}
          {phase === "error" && (
            <div className="text-center space-y-3">
              <p className="text-[13px]" style={{ color: "var(--error)" }}>
                {result.error || "通信エラー"}
              </p>
              {result.error?.includes("上限") ? (
                <button
                  onClick={() => setShowLimitModal(true)}
                  className="px-4 py-2 rounded-lg text-[13px]"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                >
                  詳細
                </button>
              ) : (
                <button
                  onClick={() => { setPhase("idle"); setResult({}); startRecording(); }}
                  className="px-4 py-2 rounded-lg text-[13px]"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                >
                  再試行
                </button>
              )}
            </div>
          )}

          {/* 完了: ← で戻る（ボタン不要、ヘッダーの戻るで対応） */}
          {phase === "done" && (
            <div className="text-center pt-2">
              <span
                className="text-[10px]"
                style={{
                  color: "var(--text-hint)",
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                }}
              >
                done
              </span>
            </div>
          )}
        </div>
      )}

      {/* 録音エリア */}
      {!isProcessing && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          {micError && (
            <p className="text-[13px] px-6 text-center" style={{ color: "var(--error)" }}>
              {micError}
            </p>
          )}

          {/* 録音ボタン: 円の中に塗り円 */}
          <div className="relative">
            <svg width="96" height="96" className="absolute -top-4 -left-4">
              <circle cx="48" cy="48" r="40" fill="none" stroke="var(--border)" strokeWidth="1" />
              {phase === "recording" && (
                <circle
                  cx="48" cy="48" r="40"
                  fill="none"
                  stroke="#222222"
                  strokeWidth="1.5"
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
                style={{ background: "var(--border)", opacity: 0.3 }}
              />
            )}

            <button
              onClick={handleTap}
              className="relative w-16 h-16 rounded-full flex items-center justify-center z-10"
              style={{
                border: "1px solid #222222",
                background: "var(--bg-secondary)",
              }}
            >
              {phase === "recording" ? (
                <div style={{ width: 16, height: 16, borderRadius: 2, background: "#222222" }} />
              ) : (
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#222222" }} />
              )}
            </button>
          </div>

          {/* 波形 */}
          <WaveformBars analyser={phase === "recording" ? analyserState : null} />

          {/* タイマー */}
          <div className="text-center">
            <p
              className="text-[13px] tabular-nums"
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                color: "var(--text-muted)",
              }}
            >
              {String(Math.floor(elapsed / 60)).padStart(1, "0")}:
              {String(elapsed % 60).padStart(2, "0")}
            </p>
          </div>
        </div>
      )}

      <div className="h-4" />
      <LimitModal open={showLimitModal} onClose={() => setShowLimitModal(false)} />
    </main>
  );
}
