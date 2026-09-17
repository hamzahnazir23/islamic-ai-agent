"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

function subscribeToConnectivity(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Tracks browser connectivity.
 *
 * useSyncExternalStore is the right primitive here: navigator.onLine is an
 * external store, and the server snapshot reports online so the first
 * paint never flashes an offline warning that hydration then removes.
 */
export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribeToConnectivity,
    () => navigator.onLine,
    () => true
  );
}

/**
 * Pins the app shell to the *visual* viewport.
 *
 * On iOS the on-screen keyboard does not shrink the layout viewport, so a
 * 100dvh shell keeps its full height and the composer ends up underneath
 * the keyboard. visualViewport reports the genuinely visible area, so the
 * shell tracks it and the composer stays reachable.
 */
export function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return; // Older browsers fall back to the dvh/vh in CSS.

    const root = document.documentElement;
    const apply = () => {
      root.style.setProperty("--app-height", `${Math.round(vv.height)}px`);
      // How much of the layout viewport the keyboard is covering.
      const inset = Math.max(
        0,
        Math.round(window.innerHeight - vv.height - vv.offsetTop)
      );
      root.style.setProperty("--kb-inset", `${inset}px`);
      root.dataset.keyboard = inset > 120 ? "open" : "closed";
    };

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    window.addEventListener("orientationchange", apply);

    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      window.removeEventListener("orientationchange", apply);
      root.style.removeProperty("--app-height");
      root.style.removeProperty("--kb-inset");
      delete root.dataset.keyboard;
    };
  }, []);
}

/**
 * Follows new messages only while the reader is already near the bottom,
 * so scrolling up to re-read is never interrupted by an arriving message.
 */
export function useStickyScroll<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T>(null);
  const pinnedRef = useRef(true);
  const [pinned, setPinned] = useState(true);

  const THRESHOLD = 120; // px from the bottom that still counts as "at the bottom"

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const next = distance <= THRESHOLD;
    pinnedRef.current = next;
    setPinned(next);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth && !reduced ? "smooth" : "auto",
    });
    pinnedRef.current = true;
    setPinned(true);
  }, []);

  useEffect(() => {
    if (pinnedRef.current) {
      const el = ref.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ref, onScroll, pinned, scrollToBottom };
}

/**
 * Keeps an unsent message in localStorage so a reload, an accidental back
 * gesture, or a backgrounded tab does not lose what was typed.
 * Scoped per user and per conversation.
 */
export function useDraft(key: string | null) {
  const [value, setValue] = useState("");
  const loadedFor = useRef<string | null>(null);

  // Reading persisted state after mount is deliberate: doing it during
  // render would make the server HTML and the first client render differ
  // and produce a hydration mismatch. This is the case the lint rule's
  // heuristic does not cover.
  useEffect(() => {
    if (!key) return;
    try {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setValue(window.localStorage.getItem(`aalim_draft_${key}`) ?? "");
    } catch {
       
      setValue("");
    }
    loadedFor.current = key;
  }, [key]);

  useEffect(() => {
    // Do not write until the draft for this key has been read, or the
    // initial empty state would erase a stored draft.
    if (!key || loadedFor.current !== key) return;
    try {
      if (value) window.localStorage.setItem(`aalim_draft_${key}`, value);
      else window.localStorage.removeItem(`aalim_draft_${key}`);
    } catch {
      /* private mode or blocked storage: drafts are a convenience only */
    }
  }, [key, value]);

  const clear = useCallback(() => {
    setValue("");
    if (!key) return;
    try {
      window.localStorage.removeItem(`aalim_draft_${key}`);
    } catch {
      /* ignore */
    }
  }, [key]);

  return { value, setValue, clear };
}

/** Remembers which conversation was open, per user, across reloads. */
export function useLastConversation(userId: number | undefined) {
  const storageKey = userId ? `aalim_last_convo_${userId}` : null;

  const read = useCallback((): number | null => {
    if (!storageKey) return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? Number(raw) || null : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const write = useCallback(
    (id: number | null) => {
      if (!storageKey) return;
      try {
        if (id) window.localStorage.setItem(storageKey, String(id));
        else window.localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    },
    [storageKey]
  );

  return { read, write };
}
