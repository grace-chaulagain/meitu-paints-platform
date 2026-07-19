import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { MobileSheet } from "./MobileSheet.jsx";

// Spec §4.3: grouped Apple-Settings lists (white group cards of 52px rows)
// replace DashboardMobileNavDrawer's sidebar-style list for dealers - a new
// component rather than a new mode on the shared drawer, since the two
// look nothing alike and DashboardMobileNavDrawer stays exactly as-is for
// Admin/Dispatcher.
export function DealerMoreDrawer({ open, onClose, groups = [], activeKey = "", onNavigate }) {
  return (
    <MobileSheet open={open} onClose={onClose} ariaLabel="More">
      <div className="dealer-m-more-title">More</div>
      {groups.map((group) => (
        <div key={group.label} className="dealer-m-more-group">
          {group.label ? <div className="dealer-m-more-group-label">{group.label}</div> : null}
          <div className="dealer-m-more-card">
            {(group.items || []).map((item) => (
              <button
                key={item.key}
                type="button"
                className={`dealer-m-more-row ${activeKey === item.key ? "active" : ""}`}
                onClick={() => onNavigate?.(item)}
              >
                <span className="dealer-m-more-row-icon">
                  <DashboardIcon name={item.icon} size={20} strokeWidth={1.7} />
                </span>
                <span className="dealer-m-more-row-label">{item.title}</span>
                <DashboardIcon name="chevron" size={14} strokeWidth={2.2} className="dealer-m-more-row-chevron" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </MobileSheet>
  );
}
