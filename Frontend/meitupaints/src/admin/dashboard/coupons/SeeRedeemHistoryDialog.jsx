import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";

// Shown when an admin clicks a row that stands for one dealer or dispatcher -
// on Payouts (a person's payout summary) and on Redeemed (a single
// redemption). Both lead to the same place, so both use this one dialog
// rather than each growing its own.
//
// `actor` is { kind: "DEALER" | "DISPATCHER", id, name }; `subtitle` is
// whatever identifies the row it was opened from.
export function SeeRedeemHistoryDialog({ actor, subtitle = "", onConfirm, onClose }) {
  if (!actor) return null;

  return (
    <div className="coupon-history-rowmenu-backdrop" onClick={onClose}>
      <div
        className="coupon-history-rowmenu"
        role="dialog"
        aria-modal="true"
        aria-label={`Actions for ${actor.name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="coupon-history-rowmenu-head">
          <strong>{actor.name}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </div>
        <button type="button" className="coupon-history-rowmenu-action" onClick={onConfirm}>
          <DashboardIcon name="history" size={14} strokeWidth={2} />
          See redeem history
        </button>
        <button type="button" className="coupon-history-rowmenu-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
