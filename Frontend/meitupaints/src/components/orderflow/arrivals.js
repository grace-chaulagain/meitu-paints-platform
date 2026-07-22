import { useEffect, useRef, useState } from "react";
import { playArrival } from "../../dealer/mobile/completionFeedback.js";
import { announce } from "../../shared/orderConflict.js";

const MUTE_KEY = "meitu_ops_sound_muted";
const CHIME_THROTTLE_MS = 10000;
const REVEAL_HOLD_MS = 2200;
const SEEN_VISIBLE_MS = 5000;

let lastChimeAt = 0;

export function isSoundMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Storage unavailable (private mode, quota) - mute just won't persist.
  }
}

function throttledArrivalChime() {
  if (isSoundMuted()) return;
  const now = Date.now();
  if (now - lastChimeAt < CHIME_THROTTLE_MS) return;
  lastChimeAt = now;
  playArrival();
}

// Diffs the incoming id list against the previous poll (this session only)
// to find genuinely new arrivals - badge pulse + highlighted-entry slide-in
// + one throttled chime, per §2.6. The first render for a given `laneKey`
// never counts as an arrival (nothing "arrived" - the page just loaded).
export function useQueueArrivals(items, laneKey, options = {}) {
  const { getId = (item) => item._id, laneLabel } = options;
  const seenIdsRef = useRef(null);
  const laneKeyRef = useRef(laneKey);
  const [arrivedIds, setArrivedIds] = useState(() => new Set());
  // Value-based, not the `items` array's own reference identity - a poll
  // (or an unrelated invalidateList()) that resolves with the same ids in
  // a freshly-allocated array would otherwise re-fire this effect, whose
  // cleanup cancels the pending REVEAL_HOLD_MS clear-timer without
  // rescheduling one (the newlyArrived-is-empty branch returns before
  // ever setting a new timer) - arrivedIds would then stay populated
  // indefinitely instead of clearing on schedule.
  const idsSignature = (items || []).map(getId).join(",");

  useEffect(() => {
    if (laneKeyRef.current !== laneKey) {
      laneKeyRef.current = laneKey;
      seenIdsRef.current = null; // switched lanes - don't treat its existing contents as arrivals
    }

    const currentIds = new Set((items || []).map(getId));
    if (seenIdsRef.current === null) {
      seenIdsRef.current = currentIds;
      return undefined;
    }

    const newlyArrived = [...currentIds].filter((id) => !seenIdsRef.current.has(id));
    seenIdsRef.current = currentIds;
    if (newlyArrived.length === 0) return undefined;

    setArrivedIds(new Set(newlyArrived));
    throttledArrivalChime();
    announce(`${newlyArrived.length} new order${newlyArrived.length > 1 ? "s" : ""} in ${laneLabel || laneKey}`);

    const timer = setTimeout(() => setArrivedIds(new Set()), REVEAL_HOLD_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsSignature, laneKey]);

  return arrivedIds;
}

function seenStampKey(userId, laneKey) {
  return `meitu_ops_seen:${userId}:${laneKey}`;
}

function getSeenStamp(userId, laneKey) {
  if (!userId || !laneKey) return 0;
  try {
    const raw = localStorage.getItem(seenStampKey(userId, laneKey));
    return raw ? new Date(raw).getTime() : 0;
  } catch {
    return 0;
  }
}

// "New since you last looked" (§2.6) - deliberately does NOT flag anything
// as new on a lane's very first-ever visit (no stamp yet == nothing to
// compare against, not "everything is new").
export function isNewSinceSeen(order, userId, laneKey, getTimestamp = (o) => o?.createdAt) {
  const stamp = getSeenStamp(userId, laneKey);
  if (!stamp) return false;
  const itemTime = new Date(getTimestamp(order) || 0).getTime();
  return itemTime > stamp;
}

// Attach `ref` to the lane's scroll container (or the page itself for a
// single-list portal). Updates the seen-stamp once the lane has actually
// been on screen for SEEN_VISIBLE_MS, not the instant it mounts.
export function useMarkLaneSeen({ userId, laneKey, containerRef, enabled = true }) {
  useEffect(() => {
    if (!enabled || !userId || !laneKey) return undefined;
    const node = containerRef?.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;

    let holdTimer = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          holdTimer = setTimeout(() => {
            try {
              localStorage.setItem(seenStampKey(userId, laneKey), new Date().toISOString());
            } catch {
              // Storage unavailable - "New" dots just won't clear, not fatal.
            }
          }, SEEN_VISIBLE_MS);
        } else if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (holdTimer) clearTimeout(holdTimer);
    };
  }, [userId, laneKey, enabled, containerRef]);
}
