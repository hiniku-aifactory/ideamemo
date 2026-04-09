"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface RecordingContextType {
  isRecording: boolean;
  setRecording: (v: boolean) => void;
  requestStop: () => void;
  onStopRequested: (() => void) | null;
  setOnStopRequested: (cb: (() => void) | null) => void;
}

const RecordingContext = createContext<RecordingContextType>({
  isRecording: false,
  setRecording: () => {},
  requestStop: () => {},
  onStopRequested: null,
  setOnStopRequested: () => {},
});

export function RecordingProvider({ children }: { children: React.ReactNode }) {
  const [isRecording, setRecording] = useState(false);
  const [onStopRequested, setOnStopRequested] = useState<(() => void) | null>(null);

  const requestStop = useCallback(() => {
    onStopRequested?.();
  }, [onStopRequested]);

  return (
    <RecordingContext.Provider value={{ isRecording, setRecording, requestStop, onStopRequested, setOnStopRequested }}>
      {children}
    </RecordingContext.Provider>
  );
}

export const useRecording = () => useContext(RecordingContext);
