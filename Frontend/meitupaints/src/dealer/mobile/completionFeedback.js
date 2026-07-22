// Apple Pay-style completion mark: two soft synthesized sine notes (no
// asset download) + a single light haptic tick. Trigger ONLY on rare,
// meaningful completions (order placed, coupon redemption confirmed, sale
// recorded) - never on add-to-cart, navigation, or anything done tens of
// times a day (emil rule: frequency gates delight).
let audioContext = null;

function getAudioContext() {
  if (audioContext) return audioContext;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  audioContext = new Ctor();
  return audioContext;
}

function playTone(ctx, frequency, startTime, duration, peakGain = 0.12) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + duration * 0.3);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

// Must be called from inside a user-gesture handler (click/tap) so the
// browser's autoplay policy allows the AudioContext to actually produce
// sound on first use. Fails silently - a missing chime must never block
// or throw during a real completion flow.
export function playCompletion() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    // A rejected resume() promise isn't caught by the surrounding
    // try/catch (only a synchronous throw would be) - .catch() keeps the
    // same fail-silent contract for the async case too.
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    playTone(ctx, 880, now, 0.09); // A5
    playTone(ctx, 1174.7, now + 0.07, 0.09); // D6, starts 70ms in
  } catch {
    // Web Audio unsupported/blocked - a silent completion is fine, a
    // thrown error interrupting the actual order/sale flow is not.
  }

  try {
    navigator.vibrate?.(10);
  } catch {
    // Vibration API unsupported/blocked - same fail-silent contract.
  }
}

// Order-flow arrival chime (§2.6) - two ascending notes, quieter and
// shorter than playCompletion() so an arrival never reads as "you just
// finished something." No haptic: this can fire from a background poll
// with no user gesture involved, unlike playCompletion(). Mute-state and
// throttling are the caller's responsibility (src/components/orderflow/arrivals.js) -
// this function just makes the sound when asked to.
export function playArrival() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    // A rejected resume() promise isn't caught by the surrounding
    // try/catch (only a synchronous throw would be) - this matters more
    // here than in playCompletion() since this can fire from a background
    // poll with no user gesture, exactly the autoplay-restricted condition
    // most likely to make resume() reject.
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    playTone(ctx, 660, now, 0.07, 0.08);
    playTone(ctx, 880, now + 0.07, 0.07, 0.08);
  } catch {
    // Same fail-silent contract as playCompletion().
  }
}
