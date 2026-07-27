// `motion` is used via JSX (<motion.div>/<motion.svg>) - this repo's eslint
// config has no react/jsx-uses-vars, so no-unused-vars can't see that usage.
// eslint-disable-next-line no-unused-vars
import { motion, useReducedMotion } from "framer-motion";

const CARD_EASE_OUT = [0.23, 1, 0.32, 1];

// The animated checkmark: circle + check path both "drawn" in via a
// pathLength animation rather than just fading/popping in - a small, fast,
// restrained flourish (DESIGN.md: "smooth, subtle motion... not flashy"),
// sequenced just after the card's own entrance so it reads as a follow-through
// rather than competing with it.
function DrawnCheckmark({ shouldReduceMotion }) {
  const lineTransition = (delay) =>
    shouldReduceMotion
      ? { duration: 0.001 }
      : { duration: 0.5, delay, ease: CARD_EASE_OUT };

  return (
    <motion.svg
      width={56}
      height={56}
      viewBox="0 0 56 56"
      fill="none"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: shouldReduceMotion ? 0.001 : 0.3, ease: CARD_EASE_OUT }}
    >
      <motion.circle
        cx={28}
        cy={28}
        r={26}
        stroke="#0071e3"
        strokeWidth={2}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={lineTransition(0.05)}
      />
      <motion.path
        d="M17 29.5 24.5 37 39.5 20"
        stroke="#0071e3"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={lineTransition(0.3)}
      />
    </motion.svg>
  );
}

export default function RegistrationSuccessCard({ title = "Application Received", message }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: shouldReduceMotion ? 0.001 : 0.4, ease: CARD_EASE_OUT }}
      style={{
        display: "grid",
        justifyItems: "center",
        textAlign: "center",
        gap: 18,
        padding: "48px 36px",
        borderRadius: 32,
        background: "#ffffff",
        border: "1px solid rgba(232,232,237,.9)",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          background: "rgba(0,113,227,.08)",
        }}
      >
        <DrawnCheckmark shouldReduceMotion={shouldReduceMotion} />
      </div>

      <div style={{ display: "grid", gap: 10, maxWidth: 440 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',system-ui,sans-serif",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            color: "#1d1d1f",
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: 0,
            fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',system-ui,sans-serif",
            fontSize: 15,
            lineHeight: 1.6,
            fontWeight: 400,
            color: "#707070",
          }}
        >
          {message}
        </p>
      </div>
    </motion.div>
  );
}
