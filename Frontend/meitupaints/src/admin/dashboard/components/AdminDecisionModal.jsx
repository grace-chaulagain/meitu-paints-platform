import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { GhostButton, Pill, PrimaryButton } from "../../../components/dashboard/DashboardUI.jsx";

const MODAL_EASE_OUT = [0.23, 1, 0.32, 1];

export default function AdminDecisionModal({
  open,
  title,
  subtitle = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  disabled = false,
  details = [],
  requireText = "",
  confirmationText = "",
  onConfirmationTextChange,
  onClose,
  onConfirm,
  children = null,
}) {
  const isDanger = tone === "danger";
  const isConfirmBlocked =
    disabled ||
    busy ||
    (requireText &&
      String(confirmationText || "").trim() !== String(requireText).trim());
  const shouldReduceMotion = useReducedMotion();
  const scale = shouldReduceMotion ? 1 : 0.95;
  const fast = shouldReduceMotion ? 0.001 : 0.16;
  const slow = shouldReduceMotion ? 0.001 : 0.22;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: fast, ease: "easeOut" }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1600,
            background: "rgba(245,245,247,.76)",
            backdropFilter: "blur(22px)",
            WebkitBackdropFilter: "blur(22px)",
            display: "grid",
            placeItems: "center",
            padding: 28,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) onClose?.();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale }}
            transition={{ duration: slow, ease: MODAL_EASE_OUT }}
            style={{
              width: "min(560px, 100%)",
              borderRadius: 30,
              border: "1px solid rgba(29,29,31,.1)",
              background: "linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,255,255,.94))",
              overflow: "hidden",
              transformOrigin: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 24, display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14, alignItems: "start" }}>
            <div>
              <Pill tone={isDanger ? "critical" : "neutral"} size="small">
                {isDanger ? "Confirm removal" : "Confirm action"}
              </Pill>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 24,
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.15,
                  color: "var(--color-ink, #1d1d1f)",
                }}
              >
                {title}
              </div>

              {subtitle ? (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    lineHeight: 1.55,
                    fontWeight: 500,
                    color: "var(--color-graphite, #707070)",
                  }}
                >
                  {subtitle}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                border: "none",
                background: "var(--color-fog, #f5f5f7)",
                color: "var(--color-graphite, #707070)",
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.55 : 1,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <DashboardIcon name="close" size={14} strokeWidth={2} />
            </button>
          </div>

          {details.length ? (
            <div
              style={{
                display: "grid",
                gap: 8,
                padding: 14,
                borderRadius: 20,
                background: "var(--color-fog, #f5f5f7)",
              }}
            >
              {details.map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "130px minmax(0,1fr)",
                    gap: 12,
                    alignItems: "baseline",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: ".04em",
                      textTransform: "uppercase",
                      color: "var(--color-graphite, #707070)",
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      minWidth: 0,
                      fontSize: 13,
                      lineHeight: 1.5,
                      fontWeight: 600,
                      color: "var(--color-ink, #1d1d1f)",
                      wordBreak: "break-word",
                    }}
                  >
                    {item.value || "-"}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {children}

          {requireText ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12.5, lineHeight: 1.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                Type <strong style={{ color: "var(--color-ink, #1d1d1f)", fontWeight: 700 }}>{requireText}</strong> to confirm.
              </div>
              <input
                value={confirmationText}
                onChange={(e) => onConfirmationTextChange?.(e.target.value)}
                disabled={busy}
                style={{
                  width: "100%",
                  height: 42,
                  borderRadius: 18,
                  border: "none",
                  background: "rgba(232,232,237,.72)",
                  padding: "0 14px",
                  outline: "none",
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "var(--color-ink, #1d1d1f)",
                }}
              />
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <GhostButton onClick={onClose} disabled={busy}>
              {cancelLabel}
            </GhostButton>

            {isDanger ? (
              <button
                type="button"
                onClick={onConfirm}
                disabled={isConfirmBlocked}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 38,
                  padding: "0 16px",
                  borderRadius: 999,
                  border: "none",
                  background: "#b42318",
                  color: "#fff",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: isConfirmBlocked ? "not-allowed" : "pointer",
                  opacity: isConfirmBlocked ? 0.55 : 1,
                }}
              >
                <DashboardIcon name="trash" size={14} strokeWidth={2} />
                {busy ? "Processing…" : confirmLabel}
              </button>
            ) : (
              <PrimaryButton icon="checkmark" onClick={onConfirm} disabled={isConfirmBlocked}>
                {busy ? "Processing…" : confirmLabel}
              </PrimaryButton>
            )}
          </div>
        </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
