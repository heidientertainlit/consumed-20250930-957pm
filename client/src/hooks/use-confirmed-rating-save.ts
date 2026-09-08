import { useEffect, useRef, useState } from "react";

interface Options<T> {
  resetKey: string;
  save: (rating: number, signal: AbortSignal) => Promise<T>;
  onSuccess: (rating: number, result: T) => void;
}

export function useConfirmedRatingSave<T>({ resetKey, save, onSuccess }: Options<T>) {
  const [saving, setSaving] = useState(false);
  const [pendingRating, setPendingRating] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const active = useRef<AbortController | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setSaving(false);
    setPendingRating(null);
    setError(null);
    setJustSaved(false);
    return () => {
      active.current?.abort();
      active.current = null;
      clearTimeout(savedTimer.current);
    };
  }, [resetKey]);

  const submit = async (rating: number) => {
    // The ref guards same-tick activations before React can disable the control.
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    clearTimeout(savedTimer.current);
    setSaving(true);
    setPendingRating(rating);
    setError(null);
    setJustSaved(false);
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const result = await save(rating, controller.signal);
      if (active.current !== controller) return;
      if (controller.signal.aborted) throw new Error("Couldn't confirm your rating was saved. Please try again.");
      onSuccess(rating, result);
      setJustSaved(true);
      savedTimer.current = setTimeout(() => setJustSaved(false), 1800);
    } catch (cause) {
      if (active.current !== controller) return;
      setError(cause instanceof Error && cause.name !== "AbortError" && cause.name !== "TypeError" && cause.name !== "SyntaxError"
        ? cause.message
        : "Couldn't confirm your rating was saved. Please try again.");
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) {
        active.current = null;
        setSaving(false);
      }
    }
  };

  return {
    saving, pendingRating, error, justSaved, submit,
    retry: () => { if (pendingRating !== null) void submit(pendingRating); },
    clear: () => { setError(null); setJustSaved(false); clearTimeout(savedTimer.current); },
  };
}