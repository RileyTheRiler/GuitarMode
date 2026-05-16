"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MicState = "idle" | "requesting" | "on" | "error";

export type MicDevice = {
  deviceId: string;
  label: string;
};

/**
 * Translate the raw getUserMedia rejection into something a user can act on.
 * The native browser messages (e.g. "Permission denied") don't tell the user
 * what to do; we map the DOMException name to a remediation hint.
 */
function describeMicError(e: unknown): string {
  if (e instanceof DOMException) {
    switch (e.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "Microphone access denied. Grant the permission in your browser's site settings, then try again.";
      case "NotFoundError":
      case "OverconstrainedError":
        return "No microphone found. Connect one and try again.";
      case "NotReadableError":
        return "Microphone is already in use by another app. Close other apps that may be using it.";
      case "AbortError":
        return "Microphone request was cancelled. Try again.";
      default:
        return e.message || "Could not access the microphone.";
    }
  }
  return e instanceof Error ? e.message : "Could not access the microphone.";
}

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
        // Restart the stream when the caller asks for a specific device that
        // differs from the active one, or when switching back to the default
        // (deviceId == null) after previously pinning a device.
        const deviceChanged =
          (deviceId != null && deviceId !== currentDeviceId) ||
          (deviceId == null && currentDeviceId != null);
        if (deviceChanged) {
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
        setError(describeMicError(e));
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
