import { useEffect, useState } from "react";
import { MobileSheet } from "../../dealer/mobile/MobileSheet.jsx";
import { PrimaryButton } from "../../dealer/mobile/PrimaryButton.jsx";
import { formatMoney } from "../../dealer/pricing.js";

// Shared Verify/Reject confirm sheet - used from both the swipe-card list
// (AdminOrdersMobileView.jsx) and the order detail push page
// (AdminOrderDetailMobileView.jsx) so the two entry points behave
// identically. Mirrors AdminOrderDetailPage.jsx's desktop AdminDecisionModal
// verify flow (optional note field, same copy) but as a MobileSheet, and
// replaces desktop's window.prompt() reject flow with the same note field
// pattern instead - window.prompt has no place in a mobile sheet UI.
export function AdminOrderConfirmSheet({ open, onClose, action, order, dealerName, busy, error, onConfirm }) {
  const [note, setNote] = useState("");

  useEffect(() => {
    // Bare value call, not wrapped in a setState updater - matches
    // SkeletonSwap.jsx's own precedent for a genuine reset-on-reopen effect.
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNote("");
    }
  }, [open]);

  const isVerify = action === "verify";

  return (
    <MobileSheet
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      ariaLabel={isVerify ? "Verify order" : "Reject order"}
      footer={
        <PrimaryButton
          onClick={() => onConfirm(note.trim())}
          loading={busy}
          variant={isVerify ? "primary" : "danger"}
        >
          {isVerify ? "Verify Order" : "Reject Order"}
        </PrimaryButton>
      }
    >
      <div className="dealer-m-newsale-title">{isVerify ? "Verify this order?" : "Reject this order?"}</div>
      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
        {isVerify
          ? "Stock is reserved and the order moves into the factory queue."
          : "The dealer will see this order as rejected. This cannot be undone."}
      </div>

      {order ? (
        <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
            {order.orderNumber} · {dealerName || "Dealer"}
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
            {formatMoney(order?.totals?.total, order?.totals?.currency)}
          </span>
        </div>
      ) : null}

      <div className="dealer-m-newsale-field-label">{isVerify ? "Verification note (optional)" : "Rejection reason (optional)"}</div>
      <textarea
        className="dealer-m-newsale-textarea"
        rows={3}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        disabled={busy}
        placeholder={isVerify ? "e.g. Payment receipt confirmed…" : "e.g. Out of stock, payment not received…"}
      />

      {error ? <div className="dealer-m-newsale-error">{error}</div> : null}
    </MobileSheet>
  );
}
