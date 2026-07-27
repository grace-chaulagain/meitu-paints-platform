// Shared, token-driven primitives for operational dashboards (Admin,
// Dispatcher, Factory). Replaces the GlassCard/MetricCard/SectionHeader
// pattern that was previously hand-copied into every dashboard page with
// hardcoded hex values. Everything here reads from the design tokens
// already defined in src/index.css (--color-ink, --color-azure, etc.)
// so dashboard chrome and the public site share one visual language.
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DashboardIcon } from "./DashboardIcons.jsx";
import { scrollResultsToTop } from "../../utils/scrollResultsToTop.js";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";
import {
  getReadOnlyButtonState,
  useReadOnlyAdminMode,
} from "./readOnlyAdminMode.jsx";

export function Surface({ children, padding = 20, style = {}, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        borderRadius: 28,
        border: "1px solid rgba(29,29,31,.08)",
        background: "linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,255,255,.92))",
        padding,
        boxShadow: "0 1px 0 rgba(255,255,255,.9) inset",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action = null, size = "default", eyebrow = "", icon = "" }) {
  const titleSize = size === "large" ? 34 : size === "small" ? 19 : 25;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        {eyebrow ? (
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--color-graphite, #707070)",
            }}
          >
            {eyebrow}
          </div>
        ) : null}
        <div
          style={{
            marginTop: eyebrow ? 4 : 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: titleSize,
            fontWeight: 800,
            letterSpacing: "-0.035em",
            color: "var(--color-ink, #1d1d1f)",
          }}
        >
          {icon ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: titleSize <= 19 ? 28 : 34,
                height: titleSize <= 19 ? 28 : 34,
                borderRadius: 999,
                background: "rgba(0,113,227,.08)",
                color: "var(--color-azure, #0071e3)",
                flexShrink: 0,
              }}
            >
              <DashboardIcon name={icon} size={titleSize <= 19 ? 14 : 17} strokeWidth={1.9} />
            </span>
          ) : null}
          <span>{title}</span>
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 5,
              fontSize: 13.5,
              lineHeight: 1.55,
              fontWeight: 500,
              color: "var(--color-graphite, #707070)",
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {action}
    </div>
  );
}

// Optional "i" affordance for a MetricTile that needs a short explainer
// (e.g. how a health score is computed). Positioned via getBoundingClientRect
// and rendered through a portal so it never gets clipped by a card's
// overflow, and can appear to either side depending on viewport space.
function MetricInfoButton({ label, info }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportPadding = 16;
    const width = Math.min(340, window.innerWidth - viewportPadding * 2);
    const rightSideLeft = rect.right + 12;
    const placeRight = rightSideLeft + width <= window.innerWidth - viewportPadding;
    const left = placeRight ? rightSideLeft : Math.max(viewportPadding, rect.left - width - 12);
    const estimatedHeight = Math.min(420, window.innerHeight - viewportPadding * 2);
    const top = Math.max(
      viewportPadding,
      Math.min(rect.top - 8, window.innerHeight - viewportPadding - estimatedHeight),
    );
    const maxHeight = Math.max(180, Math.min(420, window.innerHeight - top - viewportPadding));

    // The popover renders to whichever side of the trigger has room, so its
    // scale-in should originate from that same side (Emil Kowalski: popovers
    // should scale from their trigger, not from a fixed corner).
    setPosition({ left, top, width, maxHeight, origin: placeRight ? "top left" : "top right" });
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (popoverRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => {
            const next = !current;
            if (next) requestAnimationFrame(updatePosition);
            return next;
          });
        }}
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          border: "none",
          background: "rgba(0,0,0,.06)",
          color: "var(--color-graphite, #707070)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10.5,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        i
      </button>
      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {open && position ? (
                <motion.div
                  ref={popoverRef}
                  role="dialog"
                  aria-label={`${label} details`}
                  onClick={(event) => event.stopPropagation()}
                  initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.97 }}
                  transition={{ duration: shouldReduceMotion ? 0.001 : 0.15, ease: [0.23, 1, 0.32, 1] }}
                  style={{
                    position: "fixed",
                    top: position.top,
                    left: position.left,
                    zIndex: 9999,
                    width: position.width,
                    maxHeight: position.maxHeight,
                    overflow: "auto",
                    overscrollBehavior: "contain",
                    padding: 14,
                    borderRadius: 14,
                    border: "1px solid rgba(29,29,31,.08)",
                    background: "var(--color-snow, #fff)",
                    boxShadow: "0 8px 28px rgba(0,0,0,.14)",
                    color: "var(--color-ink, #1d1d1f)",
                    transformOrigin: position.origin,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{info.title}</div>
                  {info.summary ? (
                    <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                      {info.summary}
                    </div>
                  ) : null}
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {(info.sections || []).map((section) => (
                      <div key={section.title}>
                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            letterSpacing: ".03em",
                            textTransform: "uppercase",
                            color: "var(--color-graphite, #707070)",
                          }}
                        >
                          {section.title}
                        </div>
                        <ul style={{ margin: "6px 0 0", paddingLeft: 15, display: "grid", gap: 4, fontSize: 12, lineHeight: 1.4, fontWeight: 500 }}>
                          {section.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}

export function MetricTile({ label, value, helper = "", icon = "", tone = "neutral", info = null }) {
  const accentColor = tone === "accent" ? "var(--color-azure, #0071e3)" : "var(--color-ink, #1d1d1f)";
  return (
    <div
      className="dash-metric-tile"
      style={{
        borderRadius: 24,
        padding: "16px 17px",
        background: tone === "accent" ? "linear-gradient(145deg, rgba(0,113,227,.08), rgba(255,255,255,.92))" : "var(--color-fog, #f5f5f7)",
        border: tone === "accent" ? "1px solid rgba(0,113,227,.14)" : "1px solid rgba(29,29,31,.06)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 126,
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".07em",
            textTransform: "uppercase",
            color: "var(--color-graphite, #707070)",
          }}
        >
          {icon ? <DashboardIcon name={icon} size={14} /> : null}
          {label}
        </div>
        {info ? <MetricInfoButton label={label} info={info} /> : null}
      </div>
      <div style={{ fontSize: 31, lineHeight: 1, fontWeight: 800, letterSpacing: "-0.045em", color: accentColor }}>
        {value}
      </div>
      {helper ? (
        <div style={{ fontSize: 12, lineHeight: 1.35, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>
          {helper}
        </div>
      ) : null}
    </div>
  );
}

export function Pill({ children, tone = "neutral", size = "default", style = {} }) {
  const tones = {
    neutral: { bg: "rgba(29,29,31,.06)", color: "var(--color-slate, #474747)" },
    accent: { bg: "rgba(0,113,227,.1)", color: "var(--color-azure, #0071e3)" },
    positive: { bg: "rgba(22,163,74,.1)", color: "#15803d" },
    critical: { bg: "rgba(180,35,24,.1)", color: "#b42318" },
    caution: { bg: "rgba(182,68,0,.1)", color: "var(--color-caution, #b64400)" },
  };
  const t = tones[tone] || tones.neutral;
  const isSmall = size === "small";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: isSmall ? 23 : 28,
        padding: isSmall ? "0 9px" : "0 11px",
        borderRadius: 999,
        background: t.bg,
        color: t.color,
        fontSize: isSmall ? 11 : 12,
        fontWeight: 750,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  type = "button",
  style = {},
  icon = "",
  loading = false,
}) {
  const readOnly = useReadOnlyAdminMode();
  const readOnlyState = getReadOnlyButtonState({ readOnly, disabled, loading, children, icon });
  const isDisabled = readOnlyState.disabled;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`admin-ui-primary-btn ${readOnlyState.locked ? "admin-readonly-action-locked" : ""}`}
      data-readonly-write-action={readOnlyState.locked ? "true" : undefined}
      title={readOnlyState.title || undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 40,
        padding: "0 17px",
        borderRadius: 999,
        border: "none",
        background: isDisabled ? "rgba(0,113,227,.35)" : "var(--color-azure, #0071e3)",
        color: "#fff",
        fontSize: 13.5,
        fontWeight: 700,
        cursor: isDisabled ? "not-allowed" : "pointer",
        transition: "transform .14s var(--ease-out, ease), background .16s ease",
        ...style,
      }}
    >
      {loading ? <Spinner size={14} color="#fff" /> : icon ? <DashboardIcon name={icon} size={15} /> : null}
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, disabled = false, icon = "", danger = false, style = {} }) {
  const readOnly = useReadOnlyAdminMode();
  const readOnlyState = getReadOnlyButtonState({ readOnly, disabled, children, icon, danger });
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={readOnlyState.disabled}
      className={`admin-ui-ghost-btn ${readOnlyState.locked ? "admin-readonly-action-locked" : ""}`}
      data-readonly-write-action={readOnlyState.locked ? "true" : undefined}
      title={readOnlyState.title || undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 40,
        padding: "0 15px",
        borderRadius: 999,
        border: `1px solid ${danger ? "rgba(180,35,24,.2)" : "rgba(29,29,31,.1)"}`,
        background: "rgba(255,255,255,.88)",
        color: danger ? "#b42318" : "var(--color-ink, #1d1d1f)",
        fontSize: 13,
        fontWeight: 700,
        cursor: readOnlyState.disabled ? "not-allowed" : "pointer",
        opacity: readOnlyState.disabled ? 0.5 : 1,
        transition: "transform .14s var(--ease-out, ease), background .14s ease, border-color .14s ease",
        ...style,
      }}
    >
      {icon ? <DashboardIcon name={icon} size={14} /> : null}
      {children}
    </button>
  );
}

export function SearchField({ value, onChange, onSubmit, placeholder = "Search", style = {} }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 44,
        borderRadius: 999,
        border: "none",
        background: "rgba(232,232,237,.72)",
        padding: "0 14px",
        boxShadow: "inset 0 0 0 1px rgba(29,29,31,.045)",
        ...style,
      }}
    >
      <DashboardIcon name="search" size={14} className="dash-search-icon" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          border: "none",
          outline: "none",
          background: "transparent",
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--color-ink, #1d1d1f)",
        }}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          style={{
            width: 16,
            height: 16,
            flex: "0 0 auto",
            borderRadius: 999,
            border: "none",
            background: "rgba(0,0,0,.18)",
            color: "#fff",
            fontSize: 11,
            lineHeight: 1,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
        >
          ×
        </button>
      ) : null}
    </form>
  );
}

export function SegmentedControl({ options, value, onChange, size = "default" }) {
  const isSmall = size === "small";
  return (
    <div
      style={{
        display: "inline-flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 2,
        padding: 2,
        borderRadius: 999,
        background: "rgba(232,232,237,.72)",
      }}
    >
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className="dash-segment-btn"
            style={{
              height: isSmall ? 26 : 30,
              padding: isSmall ? "0 10px" : "0 12px",
              borderRadius: 999,
              border: "none",
              background: active ? "#fff" : "transparent",
              color: active ? "var(--color-ink, #1d1d1f)" : "var(--color-graphite, #707070)",
              fontSize: isSmall ? 12 : 13,
              fontWeight: active ? 600 : 500,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow: active ? "0 1px 2px rgba(0,0,0,.08)" : "none",
              transition: "transform .14s var(--ease-out, ease), background .14s ease, box-shadow .14s ease",
            }}
          >
            <span>{option.label}</span>
            {typeof option.count === "number" ? (
              <span
                style={{
                  minWidth: 17,
                  height: 17,
                  padding: "0 5px",
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: active ? "rgba(0,113,227,.12)" : "rgba(0,0,0,.06)",
                  color: active ? "var(--color-azure, #0071e3)" : "var(--color-graphite, #707070)",
                  fontSize: 10.5,
                  fontWeight: 700,
                }}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// Underline tab bar (flat text + 2px bottom border on the active tab,
// sitting directly on the page background rather than inside a pill) - the
// pattern already established on pages like the Dealer Profile page for a
// page's primary top-level section nav. Distinct from SegmentedControl
// (a pill-shaped, boxed control for lighter-weight filters/toggles within a
// card) - this is for a page's main tabs, rendered unboxed below the header.
export function TabBar({ options, value, onChange }) {
  return (
    <div className="dash-tab-bar" role="tablist">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.key)}
            className={`dash-tab-bar-item ${active ? "is-active" : ""}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// Apple-style popup button: a pill showing the current selection with a
// chevron. Backed by a native <select> (hidden appearance, custom skin)
// rather than a hand-rolled listbox - this guarantees correct click/keyboard/
// touch/screen-reader behavior for free, and on macOS a native <select>
// renders as the system's own popup menu, which is the most authentically
// "Apple" version of this control anyway.
export function Dropdown({ value, options, onChange, placeholder = "Select", icon = "", critical = false, style = {} }) {
  const hasValue = options.some((option) => option.key === value);
  const iconColor = critical ? "#b42318" : "var(--color-graphite, #707070)";

  return (
    <div style={{ position: "relative", ...style }}>
      {icon ? (
        <DashboardIcon
          name={icon}
          size={13}
          strokeWidth={1.8}
          style={{
            position: "absolute",
            top: "50%",
            left: 12,
            transform: "translateY(-50%)",
            color: iconColor,
            pointerEvents: "none",
          }}
        />
      ) : null}
      <select
        value={hasValue ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        className="dash-native-select"
        style={{
          width: "100%",
          height: 44,
          borderRadius: 999,
          border: critical ? "1.5px solid rgba(180,35,24,.22)" : "none",
          background: critical ? "rgba(180,35,24,.06)" : "rgba(232,232,237,.72)",
          color: critical ? "#b42318" : "var(--color-ink, #1d1d1f)",
          fontSize: 13,
          fontWeight: 650,
          padding: icon ? "0 30px 0 32px" : "0 30px 0 12px",
          cursor: "pointer",
          outline: "none",
        }}
      >
        {hasValue ? null : (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      <DashboardIcon
        name="chevron"
        size={11}
        strokeWidth={2}
        style={{
          position: "absolute",
          top: "50%",
          right: 12,
          transform: "translateY(-50%) rotate(90deg)",
          color: iconColor,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export function ListRow({ children, onClick, selected = false, style = {}, className = "" }) {
  const rowStyle = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px",
    border: "none",
    background: "transparent",
    textAlign: "left",
    ...style,
  };
  const rowClassName = `dash-list-row dash-selectable-row ${selected ? "is-selected" : ""} ${className}`;

  if (onClick) {
    // A plain div (not a real <button>) - rows routinely contain their own
    // interactive children (quick-action buttons, checkboxes), and a real
    // <button> cannot legally contain another <button> per the HTML spec.
    // role="button" + key handling keeps it just as keyboard/AT accessible.
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick(event);
          }
        }}
        className={rowClassName}
        style={{ ...rowStyle, cursor: "pointer" }}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={rowClassName} style={rowStyle}>
      {children}
    </div>
  );
}

const AVATAR_TONES = {
  neutral: { bg: "rgba(0,0,0,.06)", color: "var(--color-graphite, #707070)" },
  accent: { bg: "rgba(0,113,227,.1)", color: "var(--color-azure, #0071e3)" },
};

export function Avatar({ label = "", icon = "", tone = "accent", size = 36 }) {
  const t = AVATAR_TONES[tone] || AVATAR_TONES.accent;
  const initial = label ? String(label).trim().charAt(0).toUpperCase() : "";

  return (
    <div
      style={{
        width: size,
        height: size,
        flex: "0 0 auto",
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        background: t.bg,
        color: t.color,
        fontSize: size * 0.42,
        fontWeight: 600,
      }}
    >
      {icon ? <DashboardIcon name={icon} size={size * 0.46} strokeWidth={1.8} /> : initial}
    </div>
  );
}

export function ViewToggle({ value, onChange }) {
  const options = [
    { key: "list", icon: "list", label: "List" },
    { key: "card", icon: "overview", label: "Cards" },
  ];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        padding: 2,
        borderRadius: 999,
        background: "rgba(232,232,237,.72)",
      }}
    >
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            aria-label={`${option.label} view`}
            aria-pressed={active}
            onClick={() => onChange(option.key)}
            className="dash-segment-btn"
            style={{
              width: 30,
              height: 30,
              display: "grid",
              placeItems: "center",
              borderRadius: 999,
              border: "none",
              background: active ? "#fff" : "transparent",
              color: active ? "var(--color-ink, #1d1d1f)" : "var(--color-graphite, #707070)",
              boxShadow: active ? "0 1px 2px rgba(0,0,0,.08)" : "none",
              cursor: "pointer",
              transition: "transform .14s var(--ease-out, ease), background .14s ease, box-shadow .14s ease",
            }}
          >
            <DashboardIcon name={option.icon} size={15} strokeWidth={1.8} />
          </button>
        );
      })}
    </div>
  );
}

export function BulkActionBar({ count, onClear, children }) {
  if (!count) return null;

  return (
    <div
      className="dash-fade-up"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 12,
        background: "rgba(0,113,227,.08)",
        border: "1px solid rgba(0,113,227,.16)",
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-azure, #0071e3)" }}>
        {count} selected
      </span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>
      <button
        type="button"
        onClick={onClear}
        style={{
          marginLeft: "auto",
          border: "none",
          background: "transparent",
          color: "var(--color-graphite, #707070)",
          fontSize: 12.5,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        Clear selection
      </button>
    </div>
  );
}

export function RowCheckbox({ checked, indeterminate = false, onChange, label = "Select row" }) {
  const filled = checked || indeterminate;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className="dash-row-checkbox"
      style={{
        width: 18,
        height: 18,
        flex: "0 0 auto",
        borderRadius: 5,
        border: filled ? "none" : "1.5px solid rgba(0,0,0,.2)",
        background: filled ? "var(--color-azure, #0071e3)" : "transparent",
        display: "grid",
        placeItems: "center",
        color: "#fff",
        cursor: "pointer",
        padding: 0,
        transition: "transform .14s var(--ease-out, ease), background .14s ease, border-color .14s ease",
      }}
    >
      {indeterminate ? (
        <DashboardIcon name="minus" size={12} strokeWidth={2.8} />
      ) : checked ? (
        <DashboardIcon name="checkmark" size={12} strokeWidth={2.4} />
      ) : null}
    </button>
  );
}

// Native checkbox underneath (keyboard/a11y for free, no custom mouse/touch
// handling to get wrong) styled as an Apple-style sliding switch via CSS only.
export function ToggleSwitch({ checked, onChange, disabled = false, label = "Toggle" }) {
  return (
    <label className={`dash-toggle ${disabled ? "is-disabled" : ""}`} aria-label={label}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="dash-toggle-track">
        <span className="dash-toggle-thumb" />
      </span>
    </label>
  );
}

function buildPageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  sorted.forEach((p) => {
    if (prev && p - prev > 1) result.push("ellipsis-" + p);
    result.push(p);
    prev = p;
  });
  return result;
}

// Numbered pagination (page buttons + prev/next), for any paginated table
// or list. Deliberately un-animated on page change - page navigation is a
// frequent, functional action, not an occasional reveal, so per the
// animation-frequency framework it stays instant rather than decorative.
export function Pagination({ page, totalPages, totalCount, itemLabel = "items", onChange }) {
  if (!totalCount || totalPages <= 1) return null;

  const pages = buildPageList(page, totalPages);

  function goTo(nextPage) {
    onChange(nextPage);
    scrollResultsToTop();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
        Page {page} of {totalPages} &middot; {totalCount.toLocaleString()} {itemLabel}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          type="button"
          onClick={() => goTo(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Previous page"
          className="dash-pagination-btn"
        >
          <DashboardIcon name="chevron" size={13} strokeWidth={2.4} style={{ transform: "rotate(180deg)" }} />
        </button>
        {pages.map((p) =>
          typeof p === "number" ? (
            <button
              key={p}
              type="button"
              onClick={() => goTo(p)}
              className={`dash-pagination-btn ${p === page ? "is-active" : ""}`}
            >
              {p}
            </button>
          ) : (
            <span key={p} style={{ padding: "0 4px", color: "var(--color-graphite, #707070)", fontSize: 12.5 }}>
              &hellip;
            </span>
          ),
        )}
        <button
          type="button"
          onClick={() => goTo(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="dash-pagination-btn"
        >
          <DashboardIcon name="chevron" size={13} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

// Dense, enterprise-grade table primitive shared across admin data tabs -
// one header row (field labels are never repeated per row), numeric columns
// isolated + right-aligned with tabular-nums via `align`/`cellClassName`,
// status conveyed through a Pill passed into `render`, not a decorative
// per-row icon. Selection renders its own leading checkbox column (not part
// of the caller's `columns`) using RowCheckbox, which already stops
// propagation on click - so `onRowClick` (navigation) and selection coexist
// on the same row with no extra wrapper logic. `renderGroupHeader(row)` can
// return a full-width divider (e.g. day grouping) rendered just above that
// row; `footerCells` renders a real <tfoot> totals row.
// Mobile card renderer for DataTable - one row becomes one stacked, dense
// "card" (no per-row Surface/shadow, DESIGN.md forbids nested card clutter;
// this lives inside the same outer Surface the desktop table uses) instead
// of horizontally-scrolling a <table>. Reuses columns' own render()/
// cellClassName() as-is - callers only need to opt a column into `isTitle`
// (defaults to columns[0]) or `mobileSlot:"actions"` when the default
// first-column-as-title guess is wrong (see AttemptsTab, whose first column
// is a timestamp, not an identity field).
function DataTableMobileList({
  columns,
  rows,
  getRowKey,
  onRowClick,
  selection,
  loading,
  skeletonRowCount,
  renderGroupHeader,
  footerCells,
}) {
  const hasSelection = Boolean(selection);
  const selectedSet = hasSelection ? new Set(selection.selectedIds) : null;

  const titleColumn = columns.find((column) => column.isTitle) || columns[0];
  const actionColumns = columns.filter((column) => column.mobileSlot === "actions");
  const bodyColumns = columns.filter(
    (column) => column !== titleColumn && column.mobileSlot !== "actions" && !column.hideOnMobile,
  );

  if (loading) {
    return (
      <Surface padding={0} className="dash-table-surface">
        <div className="dash-mobile-list">
          {Array.from({ length: skeletonRowCount }).map((_, index) => (
            <div className="dash-mobile-row" key={`skeleton-${index}`}>
              <div className="dash-mobile-row-head">
                <span className="dash-table-skeleton-bar" style={{ width: `${40 + (index * 13) % 30}%`, height: 15 }} />
              </div>
              <div className="dash-mobile-fields">
                <span className="dash-table-skeleton-bar" style={{ width: "60%" }} />
                <span className="dash-table-skeleton-bar" style={{ width: "40%" }} />
              </div>
            </div>
          ))}
        </div>
      </Surface>
    );
  }

  return (
    <Surface padding={0} className="dash-table-surface">
      <div className="dash-mobile-list">
        {rows.map((row) => {
          const rowKey = getRowKey(row);
          const group = renderGroupHeader ? renderGroupHeader(row) : null;
          const selected = hasSelection && selectedSet.has(rowKey);
          return (
            <Fragment key={rowKey}>
              {group ? <div className="dash-mobile-group">{group}</div> : null}
              <div
                className={`dash-mobile-row ${onRowClick ? "is-clickable" : ""} ${selected ? "is-selected" : ""}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                <div className="dash-mobile-row-head">
                  {hasSelection ? (
                    <RowCheckbox checked={selected} onChange={() => selection.onToggleSelect(rowKey)} />
                  ) : null}
                  <div className={`dash-mobile-title ${titleColumn.cellClassName ? titleColumn.cellClassName(row) : ""}`}>
                    {titleColumn.render(row)}
                  </div>
                  {actionColumns.length ? (
                    <div className="dash-mobile-actions" onClick={(event) => event.stopPropagation()}>
                      {actionColumns.map((column) => (
                        <span key={column.key}>{column.render(row)}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
                {bodyColumns.length ? (
                  <div className="dash-mobile-fields">
                    {bodyColumns.map((column) => (
                      <Fragment key={column.key}>
                        <span className="dash-mobile-field-label">{column.header}</span>
                        <span className={`dash-mobile-field-value ${column.cellClassName ? column.cellClassName(row) : ""}`}>
                          {column.render(row)}
                        </span>
                      </Fragment>
                    ))}
                  </div>
                ) : null}
              </div>
            </Fragment>
          );
        })}
      </div>
      {footerCells ? (
        <div className="dash-mobile-row dash-mobile-footer-row">
          <div className="dash-mobile-row-head">
            <div className="dash-mobile-title">
              {footerCells.find((cell) => cell.key === titleColumn.key)?.content ?? footerCells[0]?.content}
            </div>
          </div>
          <div className="dash-mobile-fields">
            {bodyColumns.map((column) => {
              const cell = footerCells.find((footerCell) => footerCell.key === column.key);
              if (!cell) return null;
              return (
                <Fragment key={column.key}>
                  <span className="dash-mobile-field-label">{column.header}</span>
                  <span className="dash-mobile-field-value">{cell.content}</span>
                </Fragment>
              );
            })}
          </div>
        </div>
      ) : null}
    </Surface>
  );
}

export function DataTable({
  columns,
  rows,
  getRowKey,
  onRowClick = null,
  selection = null,
  loading = false,
  skeletonRowCount = 6,
  emptyState = null,
  renderGroupHeader = null,
  footerCells = null,
  minWidth = 640,
}) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const hasSelection = Boolean(selection);
  const selectedSet = hasSelection ? new Set(selection.selectedIds) : null;
  const totalCols = columns.length + (hasSelection ? 1 : 0);

  if (!loading && rows.length === 0) {
    return emptyState ? <EmptyState {...emptyState} /> : null;
  }

  const allOnPageSelected = hasSelection && rows.length > 0 && rows.every((row) => selectedSet.has(getRowKey(row)));
  const someOnPageSelected = hasSelection && !allOnPageSelected && rows.some((row) => selectedSet.has(getRowKey(row)));

  if (isMobile) {
    return (
      <DataTableMobileList
        columns={columns}
        rows={rows}
        getRowKey={getRowKey}
        onRowClick={onRowClick}
        selection={selection}
        loading={loading}
        skeletonRowCount={skeletonRowCount}
        renderGroupHeader={renderGroupHeader}
        footerCells={footerCells}
      />
    );
  }

  return (
    <Surface padding={0} className="dash-table-surface">
      <div className="dash-table-scroll">
        <table className="dash-table" style={{ minWidth }}>
          <thead>
            <tr>
              {hasSelection ? (
                <th className="dash-table-check-cell">
                  <RowCheckbox
                    checked={allOnPageSelected}
                    indeterminate={someOnPageSelected}
                    onChange={() => selection.onToggleAll()}
                    label="Select all on this page"
                  />
                </th>
              ) : null}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={column.align === "right" ? "align-right" : ""}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: skeletonRowCount }).map((_, index) => (
                  <tr key={`skeleton-${index}`}>
                    {hasSelection ? <td className="dash-table-check-cell" /> : null}
                    {columns.map((column, columnIndex) => (
                      <td key={column.key}>
                        <span
                          className="dash-table-skeleton-bar"
                          style={{ width: `${38 + ((index * 17 + columnIndex * 11) % 48)}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => {
                  const rowKey = getRowKey(row);
                  const group = renderGroupHeader ? renderGroupHeader(row) : null;
                  const selected = hasSelection && selectedSet.has(rowKey);
                  return (
                    <Fragment key={rowKey}>
                      {group ? (
                        <tr className="dash-table-group-row">
                          <td colSpan={totalCols}>{group}</td>
                        </tr>
                      ) : null}
                      <tr
                        className={`${onRowClick ? "is-clickable" : ""} ${selected ? "is-selected" : ""}`}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        tabIndex={onRowClick ? 0 : undefined}
                        onKeyDown={
                          onRowClick
                            ? (event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  onRowClick(row);
                                }
                              }
                            : undefined
                        }
                      >
                        {hasSelection ? (
                          <td className="dash-table-check-cell">
                            <RowCheckbox checked={selected} onChange={() => selection.onToggleSelect(rowKey)} />
                          </td>
                        ) : null}
                        {columns.map((column) => (
                          <td
                            key={column.key}
                            className={`${column.align === "right" ? "align-right" : ""} ${column.cellClassName ? column.cellClassName(row) : ""}`}
                          >
                            {column.render(row)}
                          </td>
                        ))}
                      </tr>
                    </Fragment>
                  );
                })}
          </tbody>
          {footerCells ? (
            <tfoot>
              <tr>
                {hasSelection ? <td /> : null}
                {footerCells.map((cell) => (
                  <td key={cell.key} className={cell.align === "right" ? "align-right" : ""}>
                    {cell.content}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </Surface>
  );
}

// Small rotating-ring loading indicator for inline use inside buttons -
// a fast spin reads as "working quickly" (perceived performance), guarded
// by prefers-reduced-motion like every other animation in this file.
export function Spinner({ size = 15, color = "#fff" }) {
  return (
    <span
      aria-hidden="true"
      className="dash-spinner"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        border: `2px solid ${color === "#fff" ? "rgba(255,255,255,.35)" : "rgba(29,29,31,.16)"}`,
        borderTopColor: color,
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

export function EmptyState({ icon = "", title, subtitle = "" }) {
  return (
    <div
      style={{
        padding: "42px 22px",
        borderRadius: 28,
        background: "linear-gradient(145deg, #f5f5f7, #ffffff)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      {icon ? (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            background: "rgba(29,29,31,.06)",
            color: "var(--color-graphite, #707070)",
          }}
        >
          <DashboardIcon name={icon} size={18} />
        </div>
      ) : null}
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{title}</div>
      {subtitle ? (
        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)", maxWidth: 320 }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

// One-time global styles for the shared primitives above - hover states,
// focus rings, and the fade-up entrance used across dashboard pages.
export function DashboardUIStyles() {
  return (
    <style>{`
      .admin-ui-primary-btn:hover:not(:disabled){ transform: translateY(-1px); filter:saturate(1.08); }
      .admin-ui-primary-btn:active:not(:disabled){ transform: scale(.97); }
      .admin-ui-ghost-btn:hover:not(:disabled){ background: rgba(29,29,31,.035); border-color: rgba(29,29,31,.18); }
      .admin-ui-ghost-btn:active:not(:disabled){ transform: scale(.97); }
      .admin-ui-primary-btn:focus-visible,
      .admin-ui-ghost-btn:focus-visible{
        outline:2px solid rgba(0,113,227,.36);
        outline-offset:2px;
      }

      .dash-segment-btn:active{ transform: scale(.93); }
      .dash-row-checkbox:active{ transform: scale(.88); }
      .factory-ui-close-btn:active{ transform: scale(.9); }

      .dash-metric-tile{
        transition:transform .18s ease, border-color .18s ease, background .18s ease;
      }
      .dash-metric-tile:hover{
        transform:translateY(-2px);
        border-color:rgba(29,29,31,.12) !important;
      }

      .dash-search-icon{ color: var(--color-graphite, #707070); flex: 0 0 auto; }

      .dash-list-row{ transition: background .14s ease; border-top: 1px solid rgba(29,29,31,.06); border-radius:16px; }
      .dash-list-row:first-child{ border-top: none; }
      div[role="button"].dash-list-row:hover{ background: rgba(29,29,31,.035); }

      /* Dealers/Dispatchers/Painters *ListRow wrappers group their trailing
         pills/stat block in a .dash-list-row-trailing container (see
         AdminDealersPage.jsx etc). On desktop those children keep their own
         fixed-pixel flex-basis inline styles unchanged; below 640px this
         drops the whole trailing group onto its own full-width wrapped row
         instead of overflowing/crushing next to the name. The !important
         overrides of the per-pill inline flex-basis mirror the same
         precedent DashboardShell.jsx already uses for its own inline-style
         grid overrides - not a new pattern. */
      @media (max-width:640px){
        .dash-list-row{ flex-wrap:wrap; row-gap:10px; }
        .dash-list-row-trailing{
          flex:1 1 100% !important;
          display:flex;
          flex-wrap:wrap;
          gap:8px;
        }
        .dash-list-row-trailing > *{ flex:0 0 auto !important; width:auto !important; }
      }

      .dash-segment-btn:hover:not(:disabled){ color: var(--color-ink, #1d1d1f); }

      .dash-tab-bar{
        display:flex;
        align-items:center;
        gap:22px;
        border-bottom:1px solid rgba(29,29,31,.08);
        overflow-x:auto;
        scrollbar-width:none;
      }
      .dash-tab-bar::-webkit-scrollbar{ display:none; }
      .dash-tab-bar-item{
        flex:0 0 auto;
        padding:12px 2px 13px;
        border:none;
        background:transparent;
        border-bottom:2px solid transparent;
        margin-bottom:-1px;
        font-size:13.5px;
        font-weight:650;
        color:var(--color-graphite, #707070);
        cursor:pointer;
        white-space:nowrap;
        transition:color .14s ease, border-color .14s ease;
      }
      .dash-tab-bar-item.is-active{
        color:var(--color-ink, #1d1d1f);
        font-weight:700;
        border-bottom-color:#dc2626;
      }
      .dash-tab-bar-item:hover:not(.is-active){
        color:var(--color-ink, #1d1d1f);
      }

      .dash-selectable-row{ transition: background .12s ease; }
      .dash-selectable-row.is-selected{ background: rgba(0,113,227,.08) !important; }

      .dash-native-select{
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
      }
      .dash-native-select::-ms-expand{ display: none; }
      .dash-native-select:focus-visible{
        outline: 2px solid rgba(0,113,227,.36);
        outline-offset: 2px;
      }
      .dash-native-select:hover{ background: rgba(232,232,237,.95) !important; }

      .dash-toggle{ position: relative; display: inline-flex; flex: 0 0 auto; cursor: pointer; }
      .dash-toggle input{ position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
      .dash-toggle-track{
        width: 44px; height: 26px; border-radius: 999px;
        background: rgba(29,29,31,.16);
        transition: background .18s var(--ease-out, ease);
        display: block; position: relative;
      }
      .dash-toggle input:checked + .dash-toggle-track{ background: var(--color-azure, #0071e3); }
      .dash-toggle-thumb{
        position: absolute; top: 2px; left: 2px; width: 22px; height: 22px;
        border-radius: 999px; background: #fff;
        box-shadow: 0 1px 3px rgba(0,0,0,.22);
        transition: transform .18s var(--ease-out, ease);
      }
      .dash-toggle input:checked + .dash-toggle-track .dash-toggle-thumb{ transform: translateX(18px); }
      .dash-toggle.is-disabled{ opacity: .5; cursor: not-allowed; }
      .dash-toggle.is-disabled input{ cursor: not-allowed; }
      .dash-toggle input:focus-visible + .dash-toggle-track{ outline: 2px solid rgba(0,113,227,.5); outline-offset: 2px; }

      .dash-fade-up{
        animation: dashFadeUp .42s cubic-bezier(.2,.7,.3,1) both;
      }
      @keyframes dashFadeUp{
        from{ opacity:0; transform:translateY(9px); }
        to{ opacity:1; transform:translateY(0); }
      }

      .dash-pagination-btn{
        min-width:30px;
        height:30px;
        padding:0 8px;
        border-radius:8px;
        border:none;
        background:transparent;
        font-size:12.5px;
        font-weight:700;
        color:var(--color-ink, #1d1d1f);
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        transition:transform .14s var(--ease-out, ease), background .14s ease, color .14s ease;
      }
      .dash-pagination-btn:disabled{
        opacity:.35;
        cursor:not-allowed;
      }
      .dash-pagination-btn.is-active{
        background:var(--color-azure, #0071e3);
        color:#fff;
      }
      .dash-pagination-btn:not(.is-active):not(:disabled):hover{
        background:rgba(29,29,31,.06);
      }
      .dash-pagination-btn:not(:disabled):active{
        transform:scale(.9);
      }

      .dash-spinner{
        animation: dashSpin .7s linear infinite;
      }
      @keyframes dashSpin{
        to{ transform:rotate(360deg); }
      }

      .dash-table-surface{ overflow:hidden; }
      .dash-table-scroll{ overflow-x:auto; }
      .dash-table{ width:100%; border-collapse:collapse; }
      .dash-table thead tr{ background:var(--color-fog, #f5f5f7); }
      .dash-table th{
        text-align:left;
        padding:11px 16px;
        font-size:10.5px;
        font-weight:700;
        letter-spacing:.05em;
        text-transform:uppercase;
        color:var(--color-graphite, #707070);
        white-space:nowrap;
      }
      .dash-table th.align-right,
      .dash-table td.align-right{ text-align:right; }
      .dash-table td{
        padding:12px 16px;
        font-size:13px;
        border-top:1px solid rgba(0,0,0,.05);
        color:var(--color-ink, #1d1d1f);
      }
      .dash-table tbody tr:not(.dash-table-group-row){ transition:background .12s ease; }
      .dash-table tbody tr.is-clickable{ cursor:pointer; }
      .dash-table tbody tr.is-clickable:hover{ background:rgba(0,113,227,.035); }
      .dash-table tbody tr.is-clickable:focus-visible{
        outline:2px solid rgba(0,113,227,.36);
        outline-offset:-2px;
      }
      .dash-table tbody tr.is-selected{ background:rgba(0,113,227,.06) !important; }
      .dash-table-check-cell{ width:40px; padding-right:0 !important; }
      .dash-table-mono{
        font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-weight:700;
        letter-spacing:-.01em;
      }
      .dash-table-tabular{ font-variant-numeric:tabular-nums; }
      .dash-table-group-row td{
        padding:14px 16px 6px;
        background:transparent;
        border-top:none;
        font-size:12px;
        font-weight:650;
        color:var(--color-graphite, #707070);
      }
      .dash-table-group-row:first-child td{ padding-top:6px; }
      .dash-table-group-dot{
        width:7px;
        height:7px;
        border-radius:999px;
        background:var(--color-azure, #0071e3);
        box-shadow:0 0 0 3px rgba(0,113,227,.1);
        display:inline-block;
        margin-right:8px;
      }
      .dash-table-group-row strong{ color:var(--color-ink, #1d1d1f); font-weight:800; }
      .dash-table tfoot tr{ border-top:2px solid rgba(29,29,31,.12); background:rgba(0,113,227,.04); }
      .dash-table tfoot td{ padding:12px 16px; font-size:13px; font-weight:800; color:var(--color-ink, #1d1d1f); }

      /* DataTable mobile card fallback (<=640px, see useMediaQuery in DataTable) */
      .dash-mobile-list{ display:flex; flex-direction:column; }
      .dash-mobile-row{ padding:13px 16px; border-top:1px solid rgba(29,29,31,.06); }
      .dash-mobile-list > .dash-mobile-row:first-child,
      .dash-mobile-list > .dash-mobile-group:first-child{ border-top:none; }
      .dash-mobile-row.is-clickable{ cursor:pointer; transition:background .12s ease; }
      .dash-mobile-row.is-clickable:active{ background:rgba(0,113,227,.06); }
      .dash-mobile-row.is-clickable:focus-visible{ outline:2px solid var(--color-azure, #0071e3); outline-offset:-2px; }
      .dash-mobile-row.is-selected{ background:rgba(0,113,227,.06); }
      .dash-mobile-row-head{ display:flex; align-items:center; gap:10px; min-height:22px; }
      .dash-mobile-title{ flex:1; min-width:0; font-size:14px; font-weight:700; color:var(--color-ink, #1d1d1f); overflow-wrap:break-word; }
      .dash-mobile-actions{ display:flex; align-items:center; gap:2px; flex:0 0 auto; }
      .dash-mobile-group{ padding:14px 16px 4px; font-size:12px; font-weight:800; color:var(--color-graphite, #707070); }
      .dash-mobile-fields{
        display:grid;
        grid-template-columns:auto 1fr;
        column-gap:10px;
        row-gap:6px;
        margin-top:9px;
        padding-top:9px;
        border-top:1px solid rgba(29,29,31,.06);
      }
      .dash-mobile-field-label{ font-size:11.5px; font-weight:600; color:var(--color-graphite, #707070); white-space:nowrap; align-self:start; }
      .dash-mobile-field-value{ font-size:13px; font-weight:600; color:var(--color-ink, #1d1d1f); text-align:right; min-width:0; overflow-wrap:break-word; }
      .dash-mobile-footer-row{ background:rgba(0,113,227,.04); border-top:2px solid rgba(29,29,31,.12); }
      .dash-mobile-footer-row .dash-mobile-title,
      .dash-mobile-footer-row .dash-mobile-field-value{ font-weight:800; }
      .dash-table-skeleton-bar{
        display:block;
        height:14px;
        border-radius:7px;
        background:linear-gradient(90deg, rgba(0,0,0,.045), rgba(0,0,0,.02), rgba(0,0,0,.045));
      }

      @media (prefers-reduced-motion: reduce){
        .dash-fade-up{ animation: none; }
        .dash-metric-tile,
        .admin-ui-primary-btn,
        .admin-ui-ghost-btn,
        .dash-segment-btn,
        .dash-row-checkbox,
        .dash-toggle-track,
        .dash-toggle-thumb,
        .dash-pagination-btn,
        .dash-table tbody tr,
        .dash-mobile-row,
        .factory-ui-close-btn{ transition:none !important; }
        .admin-ui-primary-btn:active:not(:disabled),
        .admin-ui-ghost-btn:active:not(:disabled),
        .dash-segment-btn:active,
        .dash-row-checkbox:active,
        .dash-pagination-btn:active,
        .factory-ui-close-btn:active{ transform:none !important; }
        .dash-spinner{ animation:none; }
      }

      .apple-date-field-trigger{
        display:inline-flex;
        align-items:center;
        gap:7px;
        height:34px;
        padding:0 12px;
        border:none;
        border-radius:9px;
        background:var(--color-fog, #f5f5f7);
        color:var(--color-ink, #1d1d1f);
        font-size:13px;
        font-weight:500;
        font-family:inherit;
        cursor:pointer;
        transition:transform .14s var(--ease-out, ease), background .14s ease;
      }
      .apple-date-field-trigger:hover{
        background:rgba(29,29,31,.09);
      }
      .apple-date-field-trigger:active{
        transform:scale(.97);
      }
      .apple-date-field-trigger:focus-visible{
        outline:2px solid rgba(0,113,227,.36);
        outline-offset:2px;
      }

      .apple-calendar-pop{
        z-index:1401;
        padding:18px;
        border-radius:20px;
        background:#fff;
        border:1px solid rgba(0,0,0,.06);
        box-shadow:0 16px 40px rgba(0,0,0,.14), 0 1px 0 rgba(0,0,0,.04);
        transform-origin:top left;
        animation:appleCalendarIn .16s var(--ease-out, cubic-bezier(.23,1,.32,1)) both;
      }
      @keyframes appleCalendarIn{
        from{ opacity:0; transform:scale(.95); }
        to{ opacity:1; transform:scale(1); }
      }
      .apple-calendar-header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-bottom:14px;
      }
      .apple-calendar-month{
        font-size:16px;
        font-weight:700;
        letter-spacing:-.01em;
        color:var(--color-ink, #1d1d1f);
      }
      .apple-calendar-nav{
        width:28px;
        height:28px;
        border-radius:999px;
        border:none;
        background:transparent;
        color:var(--color-azure, #0071e3);
        display:grid;
        place-items:center;
        cursor:pointer;
        transition:background .14s ease, transform .14s var(--ease-out, ease);
      }
      .apple-calendar-nav:hover{
        background:rgba(0,113,227,.08);
      }
      .apple-calendar-nav:active{
        transform:scale(.9);
      }
      .apple-calendar-weekdays{
        display:grid;
        grid-template-columns:repeat(7, 1fr);
        margin-bottom:4px;
      }
      .apple-calendar-weekdays span{
        text-align:center;
        font-size:10.5px;
        font-weight:700;
        letter-spacing:.02em;
        text-transform:uppercase;
        color:var(--color-graphite, #707070);
        padding:4px 0;
      }
      .apple-calendar-grid{
        display:grid;
        grid-template-columns:repeat(7, 1fr);
        row-gap:2px;
      }
      .apple-calendar-day{
        width:100%;
        aspect-ratio:1;
        border:none;
        border-radius:999px;
        background:transparent;
        color:var(--color-ink, #1d1d1f);
        font-size:14.5px;
        font-weight:500;
        cursor:pointer;
        display:grid;
        place-items:center;
        transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease);
      }
      .apple-calendar-day:hover{
        background:rgba(29,29,31,.06);
      }
      .apple-calendar-day:active{
        transform:scale(.9);
      }
      .apple-calendar-day.is-today{
        color:var(--color-azure, #0071e3);
        font-weight:700;
      }
      .apple-calendar-day.is-selected{
        background:var(--color-azure, #0071e3);
        color:#fff;
        font-weight:700;
      }
      .apple-calendar-day.is-selected:hover{
        background:var(--color-azure, #0071e3);
      }
      @media (prefers-reduced-motion: reduce){
        .apple-calendar-pop{ animation:none!important; }
        .apple-date-field-trigger{ transition:none!important; }
        .apple-calendar-day,
        .apple-calendar-nav{ transition:none!important; }
      }

      .apple-dropdown-menu-trigger{
        display:inline-flex;
        align-items:center;
        gap:8px;
        width:100%;
        height:44px;
        padding:0 14px;
        border:none;
        border-radius:999px;
        background:rgba(232,232,237,.72);
        color:var(--color-ink, #1d1d1f);
        font-size:13px;
        font-weight:650;
        font-family:inherit;
        cursor:pointer;
        transition:background .16s ease;
      }
      .apple-dropdown-menu-trigger:hover{
        background:rgba(232,232,237,.95);
      }
      .apple-dropdown-menu-trigger:focus-visible{
        outline:2px solid rgba(0,113,227,.36);
        outline-offset:2px;
      }
      .apple-dropdown-menu-trigger span{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .apple-dropdown-menu{
        z-index:1401;
        max-height:340px;
        overflow-y:auto;
        overflow-x:hidden;
        border-radius:14px;
        background:#fff;
        border:1px solid rgba(0,0,0,.07);
        box-shadow:0 16px 40px rgba(0,0,0,.14), 0 1px 0 rgba(0,0,0,.04);
        transform-origin:top;
        animation:appleDropdownMenuIn .15s var(--ease-out, cubic-bezier(.23,1,.32,1)) both;
      }
      @keyframes appleDropdownMenuIn{
        from{ opacity:0; transform:scale(.96) translateY(-4px); }
        to{ opacity:1; transform:scale(1) translateY(0); }
      }
      .apple-dropdown-menu-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        width:100%;
        padding:11px 14px;
        border:none;
        background:transparent;
        color:var(--color-ink, #1d1d1f);
        font-size:13.5px;
        font-weight:550;
        font-family:inherit;
        text-align:left;
        cursor:pointer;
      }
      .apple-dropdown-menu-row + .apple-dropdown-menu-row{
        border-top:1px solid rgba(0,0,0,.06);
      }
      .apple-dropdown-menu-row.is-highlighted{
        background:rgba(0,113,227,.08);
      }
      @media (prefers-reduced-motion: reduce){
        .apple-dropdown-menu{ animation:none!important; }
      }
    `}</style>
  );
}
