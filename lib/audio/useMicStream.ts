"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MicState = "idle" | "requesting" | "on" | "error";

export type MicDevice = {
  deviceId: string;
  label: string;
};

export function useMicStream() {
  const [state, setState] = useState<MicState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MicDevice[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all
        .filter((d) => d.kind === "audioinput")
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${idx + 1}`,
        }));
      setDevices(inputs);
    } catch {
      /* ignore */
    }
  }, []);

  const start = useCallback(
    async (deviceId?: string | null) => {
      if (streamRef.current) {
        // If device changed, restart the stream.
        if (deviceId && deviceId !== currentDeviceId) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        } else {
          return streamRef.current;
        }
      }
      setState("requesting");
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: false,
        });
        streamRef.current = stream;
        setCurrentDeviceId(deviceId ?? null);
        setState("on");
        refreshDevices();
        return stream;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Microphone access denied";
        setError(msg);
        setState("error");
        throw e;
      }
    },
    [currentDeviceId, refreshDevices]
  );

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setState("idle");
  }, []);

  useEffect(() => {
    // Populate device list on mount (labels are empty until mic permission granted).
    refreshDevices();
    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
      return () => {
        navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [refreshDevices]);

  return {
    state,
    error,
    devices,
    currentDeviceId,
    start,
    stop,
    streamRef,
  };
}
