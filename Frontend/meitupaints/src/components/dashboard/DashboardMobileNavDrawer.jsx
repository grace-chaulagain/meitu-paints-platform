import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DashboardIcon } from "./DashboardIcons.jsx";

// A left-anchored "sidebar pop-up" - the mobile equivalent of the desktop
// rail, not a bottom sheet: same content (title/eyebrow, nav groups,
// account label), just presented as a dismissible overlay instead of a
// persistent column. Slides in with the iOS-native drawer curve rather than
// the modal/sheet ease-out used elsewhere in this dashboard (Vaul/Ionic use
// this exact curve for edge-anchored panels) - entry gets the fuller
// "arrival" motion, exit is snappier, matching the asymmetric enter/exit
// convention (slow where the user is deciding, fast where the system
// responds).
const DRAWER_EASE_IN = [0.32, 0.72, 0, 1];

function badgeText(value) {
  return value === null || value === undefined ? "" : String(value);
}

export default function DashboardMobileNavDrawer({
  open,
  onClose,
  title,
  eyebrow,
  accountLabel = "",
  groups = [],
  activeKey = "",
  onNavigate,
}) {
  const shouldReduceMotion = useReducedMotion();
  const fast = shouldReduceMotion ? 0.001 : 0.16;
  const enter = shouldReduceMotion ? 0.001 : 0.32;
  const exit = shouldReduceMotion ? 0.001 : 0.2;
  const travel = shouldReduceMotion ? 0 : -18;

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return createPortal(
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
            zIndex: 1650,
            background: "rgba(245,245,247,.76)",
            backdropFilter: "blur(22px)",
            WebkitBackdropFilter: "blur(22px)",
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose?.();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${title || "Dashboard"} navigation`}
            initial={{ opacity: 0, x: travel }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: travel }}
            transition={{ duration: open ? enter : exit, ease: DRAWER_EASE_IN }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              bottom: 0,
              width: "min(320px, 84vw)",
              display: "flex",
              flexDirection: "column",
              background: "linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,255,255,.96))",
              borderRight: "1px solid rgba(29,29,31,.1)",
              boxShadow: "0 12px 48px rgba(15,23,42,.14)",
              paddingTop: "env(safe-area-inset-top, 0px)",
              paddingLeft: "env(safe-area-inset-left, 0px)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 16px 14px" }}>
              <div style={{ minWidth: 0 }}>
                {eyebrow ? (
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: ".08em",
                      textTransform: "uppercase",
                      color: "rgba(0,0,0,.4)",
                    }}
                  >
                    {eyebrow}
                  </div>
                ) : null}
                <div style={{ marginTop: 2, fontSize: 18, fontWeight: 800, letterSpacing: "-.03em", color: "var(--color-ink, #1d1d1f)" }}>
                  {title}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                style={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  borderRadius: 999,
                  border: "none",
                  background: "var(--color-fog, #f5f5f7)",
                  color: "var(--color-graphite, #707070)",
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                }}
              >
                <DashboardIcon name="close" size={14} strokeWidth={2} />
              </button>
            </div>

            <nav
              aria-label="Dashboard sections"
              style={{
                flex: "1 1 auto",
                minHeight: 0,
                overflowY: "auto",
                padding: "4px 10px 12px",
                display: "grid",
                alignContent: "start",
                gap: 16,
              }}
            >
              {groups.map((group) => (
                <div key={group.label || "group"}>
                  {group.label ? (
                    <div
                      style={{
                        padding: "0 10px 7px",
                        fontSize: 10.5,
                        fontWeight: 800,
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                        color: "rgba(0,0,0,.38)",
                      }}
                    >
                      {group.label}
                    </div>
                  ) : null}
                  <div style={{ display: "grid", gap: 3 }}>
                    {(group.items || []).map((item) => {
                      const active = activeKey === item.key;
                      const badge = badgeText(item.badge);
                      const iconName = item.icon || item.iconName || "";
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => onNavigate?.(item)}
                          className="dashboard-mobile-drawer-item"
                          style={{
                            width: "100%",
                            minHeight: 44,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "0 10px",
                            borderRadius: 12,
                            border: "none",
                            background: active ? "rgba(0,113,227,.1)" : "transparent",
                            color: active ? "var(--color-azure, #0071e3)" : "var(--color-ink, #1d1d1f)",
                            textAlign: "left",
                            cursor: "pointer",
                          }}
                        >
                          {iconName ? (
                            <span
                              style={{
                                width: 24,
                                height: 24,
                                flexShrink: 0,
                                borderRadius: 999,
                                display: "grid",
                                placeItems: "center",
                                background: active ? "rgba(0,113,227,.14)" : "rgba(29,29,31,.045)",
                                color: active ? "var(--color-azure, #0071e3)" : "rgba(0,0,0,.5)",
                              }}
                            >
                              <DashboardIcon name={iconName} size={15} strokeWidth={1.7} />
                            </span>
                          ) : null}
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600 }}>{item.title}</span>
                          {badge ? (
                            <span
                              style={{
                                minWidth: 18,
                                height: 18,
                                padding: "0 6px",
                                borderRadius: 999,
                                background: active ? "rgba(0,113,227,.16)" : "rgba(29,29,31,.07)",
                                color: active ? "var(--color-azure, #0071e3)" : "rgba(0,0,0,.5)",
                                fontSize: 10,
                                fontWeight: 600,
                                display: "grid",
                                placeItems: "center",
                              }}
                            >
                              {badge}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {accountLabel ? (
              <div
                style={{
                  flex: "0 0 auto",
                  padding: "12px 16px",
                  borderTop: "1px solid rgba(29,29,31,.08)",
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: "rgba(0,0,0,.4)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={accountLabel}
              >
                {accountLabel}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
