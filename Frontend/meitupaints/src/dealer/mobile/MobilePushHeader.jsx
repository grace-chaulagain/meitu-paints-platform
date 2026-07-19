import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";

// 44px back-chevron header for any pushed (non-tab-root) screen - order
// detail, etc. Title centered, SF-style 17px semibold (spec §3).
export function MobilePushHeader({ title, onBack, action = null }) {
  return (
    <div className="dealer-m-push-header">
      <button type="button" className="dealer-m-push-back" onClick={onBack} aria-label="Back">
        <DashboardIcon name="chevron" size={16} strokeWidth={2.3} style={{ transform: "rotate(180deg)" }} />
      </button>
      <div className="dealer-m-push-title">{title}</div>
      <div className="dealer-m-push-action">{action}</div>
    </div>
  );
}
