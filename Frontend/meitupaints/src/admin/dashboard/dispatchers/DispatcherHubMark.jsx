import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";

// The dispatcher's identity mark: a rounded square with a truck badge, where
// a dealer gets a round avatar. Used wherever a dispatcher heads a page so the
// two kinds of account never look alike at a glance.

const DISPATCHER_ACCENT = "#4a5a8a";
const DISPATCHER_ACCENT_SOFT = "rgba(74,90,138,.1)";

function initials(label) {
  const words = String(label || "Dispatcher").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return String(label || "DS").slice(0, 2).toUpperCase();
}

export default function DispatcherHubMark({ label, size = 58 }) {
  const badge = Math.round(size * 0.41);
  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        width: size,
        height: size,
        flex: "0 0 auto",
        borderRadius: Math.round(size * 0.28),
        display: "grid",
        placeItems: "center",
        background: DISPATCHER_ACCENT_SOFT,
        color: DISPATCHER_ACCENT,
        fontSize: Math.round(size * 0.33),
        fontWeight: 750,
        letterSpacing: "-.01em",
      }}
    >
      <span>{initials(label)}</span>
      <span
        style={{
          position: "absolute",
          right: -5,
          bottom: -5,
          width: badge,
          height: badge,
          borderRadius: Math.round(badge / 3),
          display: "grid",
          placeItems: "center",
          background: DISPATCHER_ACCENT,
          color: "#fff",
          boxShadow: "0 0 0 3px #fff",
        }}
      >
        <DashboardIcon name="truck" size={Math.max(10, Math.round(badge * 0.5))} strokeWidth={2} />
      </span>
    </div>
  );
}
