import { useCallback, useEffect, useState } from "react";

// Module-level pub-sub, not React context - toast() needs to be callable
// from anywhere (event handlers, other hooks) without prop-drilling a
// context value through every screen. MobileToastRenderer (mounted once
// in DealerDashboardPage.jsx) is the sole subscriber.
let listener = null;

// `action` (V3 §4): an optional trailing button, e.g. `{ label: "Undo",
// onClick }`, rendered by MobileToastRenderer. `duration` (ms) overrides the
// default 2500 - toasts carrying an action stay up longer (5000) since
// there's something to read and decide on, not just acknowledge.
export function toast(message, { icon, action, duration } = {}) {
  listener?.({ message, icon, action, duration, key: Date.now() + Math.random() });
}

// "Max 1 visible (queue, don't stack) - this is a phone, not a dashboard."
// A second toast() call while one is already shown/entering does NOT queue
// a separate full exit+enter cycle - it replaces the visible toast's
// content in place (same DOM node, timer resets), which is what lets a
// rapid second toast retarget instead of restarting from scratch.
export function useToastQueue() {
  const [current, setCurrent] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | entering | shown | exiting

  useEffect(() => {
    listener = (item) => {
      setCurrent(item);
      setPhase((prev) => (prev === "idle" || prev === "exiting" ? "entering" : "shown"));
    };
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (phase !== "entering") return undefined;
    const raf = requestAnimationFrame(() => setPhase("shown"));
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (phase !== "shown") return undefined;
    const timer = setTimeout(() => setPhase("exiting"), current?.duration ?? 2500);
    return () => clearTimeout(timer);
  }, [phase, current]);

  useEffect(() => {
    if (phase !== "exiting") return undefined;
    const timer = setTimeout(() => setCurrent(null), 200);
    return () => clearTimeout(timer);
  }, [phase]);

  const dismiss = useCallback(() => {
    setPhase((prev) => (prev === "shown" || prev === "entering" ? "exiting" : prev));
  }, []);

  return { current, phase, dismiss };
}
