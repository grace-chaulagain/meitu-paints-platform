import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { skipToken } from "@reduxjs/toolkit/query";
import { motion } from "framer-motion";
import {
  useGetStockDetailQuery,
  useGetStockHistoryQuery,
  useUpdateStockQuantityMutation,
  useUpdateStockThresholdMutation,
} from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { GhostButton, Pill, PrimaryButton, SectionHeader } from "../../components/dashboard/DashboardUI.jsx";
import { AppleDropdown } from "../../components/dashboard/ApplePickers.jsx";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { Banner, CloseButton, Disclosure, ModalOverlay, MovementBadge } from "../factoryUI.jsx";
import { STOCK_REASONS, compactDate, fieldInputStyle, statusTone, titleCaseLabel } from "../factoryHelpers.js";

// Factory staff open this dialog many times a day for a task that's really
// just "how many do we have now" - the old version buried that behind a
// Quick/Exact mode switch, two parallel ways to apply a delta (preset chips
// AND a separate custom-amount+Add/Remove pair), an unrelated threshold
// field bolted on next to Reason, and a mandatory Review-then-Confirm step
// for every single change no matter how small. Redesigned around one big
// stepper as the only way to change the number (typing it directly covers
// an exact recount - no separate mode needed), with the review step now
// reserved for genuinely large changes instead of every change. Secondary
// detail (threshold/notes, who's holding a reservation, audit history) is
// tucked behind matching collapsed disclosures instead of competing with
// the primary action for attention.
const REASON_OPTIONS = STOCK_REASONS.map((item) => ({ key: item, label: item }));
const NUDGES = [-10, -5, 5, 10];
const LARGE_ADJUSTMENT_THRESHOLD = 100;

export default function FactoryStockEditModal({ product, onClose }) {
  const [newStock, setNewStock] = useState(product?.stock?.currentQuantity || 0);
  const [threshold, setThreshold] = useState(product?.stock?.lowStockThreshold || 0);
  const [reason, setReason] = useState("Manual Count");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const [updateStock, stockState] = useUpdateStockQuantityMutation();
  const [updateThreshold, thresholdState] = useUpdateStockThresholdMutation();
  const detailQuery = useGetStockDetailQuery(product ? product.productId || product._id : skipToken);
  const historyQuery = useGetStockHistoryQuery(
    product ? { productId: product.productId || product._id, limit: 6, onlyMovements: "true" } : skipToken,
  );

  if (!product) return null;

  const current = Number(product.stock?.currentQuantity || 0);
  const next = Number(newStock || 0);
  const delta = next - current;
  const thresholdChanged = Number(threshold) !== Number(product.stock?.lowStockThreshold || 0);
  const hasChange = delta !== 0 || thresholdChanged;
  const saving = stockState.isLoading || thresholdState.isLoading;
  const isLargeChange = Math.abs(delta) >= LARGE_ADJUSTMENT_THRESHOLD;
  const reservedQuantity = Number(product.stock?.reservedQuantity || 0);
  const reservations = detailQuery.data?.reservations || [];

  function nudge(amount) {
    setConfirming(false);
    setError("");
    setNewStock((value) => Math.max(0, Number(value || 0) + amount));
  }

  function resetStock() {
    setConfirming(false);
    setError("");
    setNewStock(current);
    setThreshold(product.stock?.lowStockThreshold || 0);
  }

  function viewFullHistory() {
    navigate(`/factory/dashboard/stock-history?q=${encodeURIComponent(product.sku)}`);
  }

  async function commit() {
    setError("");
    try {
      if (delta !== 0) {
        await updateStock({ productId: product.productId || product._id, payload: { newQuantity: next, reason, note } }).unwrap();
      }
      if (thresholdChanged) {
        await updateThreshold({ productId: product.productId || product._id, payload: { lowStockThreshold: Number(threshold), reason, note } }).unwrap();
      }
      onClose();
    } catch (err) {
      setError(getQueryErrorMessage(err, "Stock update failed."));
    }
  }

  function handleSaveClick() {
    if (!hasChange) return;
    if (isLargeChange && !confirming) {
      setConfirming(true);
      return;
    }
    commit();
  }

  return (
    <ModalOverlay open={Boolean(product)} onClose={onClose} maxWidth={480}>
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <SectionHeader
            eyebrow={[product.sku, product.packLabel || product.pack?.label].filter(Boolean).join(" · ")}
            icon="stock"
            title={product.name}
          />
          <CloseButton onClick={onClose} />
        </div>

        <div className="stock-stepper-card">
          <div className="stock-stepper-head">
            <span>Available Stock</span>
            {hasChange ? (
              <button type="button" className="stock-stepper-reset" onClick={resetStock}>
                Reset
              </button>
            ) : null}
          </div>

          <div className="stock-stepper-row">
            <button
              type="button"
              className="stock-stepper-btn"
              onClick={() => nudge(-1)}
              disabled={next <= 0}
              aria-label="Decrease by 1"
            >
              <DashboardIcon name="minus" size={18} strokeWidth={2.6} />
            </button>

            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={newStock}
              onChange={(event) => {
                setConfirming(false);
                setError("");
                setNewStock(event.target.value);
              }}
              className="stock-stepper-input"
              aria-label="New stock quantity"
            />

            <button type="button" className="stock-stepper-btn is-add" onClick={() => nudge(1)} aria-label="Increase by 1">
              <DashboardIcon name="plus" size={18} strokeWidth={2.6} />
            </button>
          </div>

          <div className="stock-stepper-foot">
            <span>Currently {current}</span>
            {delta !== 0 ? <MovementBadge delta={delta} /> : null}
          </div>

          <div className="stock-stepper-nudges">
            {NUDGES.map((amount) => (
              <button key={amount} type="button" className="stock-nudge-chip" onClick={() => nudge(amount)}>
                {amount > 0 ? `+${amount}` : amount}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Reason</span>
          <AppleDropdown value={reason} options={REASON_OPTIONS} onChange={setReason} />
        </label>

        <div style={{ display: "grid", gap: 10 }}>
          <Disclosure label="Advanced — low stock threshold, notes">
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Low Stock Threshold</span>
                <input
                  type="number"
                  min="0"
                  value={threshold}
                  onChange={(event) => {
                    setConfirming(false);
                    setThreshold(event.target.value);
                  }}
                  style={fieldInputStyle()}
                />
              </label>
              <label style={{ display: "grid", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Notes</span>
                <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} style={{ ...fieldInputStyle(), height: "auto", padding: 10, resize: "vertical" }} />
              </label>
            </div>
          </Disclosure>

          <Disclosure
            label={
              reservedQuantity > 0
                ? `Reserved — ${reservedQuantity} unit${reservedQuantity === 1 ? "" : "s"} held across ${reservations.length || "…"} order${reservations.length === 1 ? "" : "s"}`
                : "Reserved — none"
            }
          >
            {detailQuery.isLoading ? (
              <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>Loading…</span>
            ) : reservations.length === 0 ? (
              <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>No orders currently hold a reservation on this product.</span>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {reservations.map((row) => (
                  <div key={row.orderId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{row.orderNumber}</div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                        {row.dealerName || "—"} · <Pill tone={statusTone(row.status)} size="small">{titleCaseLabel(row.status)}</Pill>
                      </div>
                    </div>
                    <strong style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", flexShrink: 0 }}>{row.reservedQuantity}</strong>
                  </div>
                ))}
              </div>
            )}
          </Disclosure>

          <Disclosure label={`Recent Activity${historyQuery.data?.items?.length ? ` (${historyQuery.data.items.length})` : ""}`}>
            {(historyQuery.data?.items || []).length === 0 ? (
              <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>No stock movements yet.</span>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {historyQuery.data.items.map((row) => (
                  <div key={row._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{row.reason}</div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{compactDate(row.changedAt)}</div>
                    </div>
                    <MovementBadge delta={row.delta} />
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="stock-view-all-btn" onClick={viewFullHistory}>
              <span>View full history for this product</span>
              <DashboardIcon name="chevron" size={12} strokeWidth={2.4} />
            </button>
          </Disclosure>
        </div>

        {error ? <Banner tone="error">{error}</Banner> : null}

        {confirming ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{ display: "grid", gap: 8, padding: 16, borderRadius: 14, background: "rgba(180,35,24,.06)" }}
          >
            <strong style={{ fontSize: 13, color: "var(--color-ink, #1d1d1f)" }}>
              This is a large change — {current} → {next} ({delta >= 0 ? `+${delta}` : delta}). Confirm?
            </strong>
            <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>Reason: {reason}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <GhostButton onClick={() => setConfirming(false)}>Back</GhostButton>
              <PrimaryButton icon="checkmark" onClick={commit} disabled={saving}>
                {saving ? "Saving…" : "Confirm Save"}
              </PrimaryButton>
            </div>
          </motion.div>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <GhostButton onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton icon="checkmark" onClick={handleSaveClick} disabled={!hasChange || saving}>
              {saving ? "Saving…" : "Save Changes"}
            </PrimaryButton>
          </div>
        )}
      </div>

      <style>{`
        .stock-stepper-card{
          display:grid;
          gap:12px;
          justify-items:center;
          padding:22px 20px;
          border-radius:24px;
          background:var(--color-fog, #f5f5f7);
        }
        .stock-stepper-head{
          width:100%;
          display:flex;
          align-items:center;
          justify-content:center;
          position:relative;
          font-size:11px;
          font-weight:700;
          letter-spacing:.06em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
        }
        .stock-stepper-reset{
          position:absolute;
          right:0;
          border:none;
          background:transparent;
          color:var(--color-azure, #0071e3);
          font-size:11.5px;
          font-weight:700;
          letter-spacing:0;
          text-transform:none;
          cursor:pointer;
          padding:2px 4px;
        }
        .stock-stepper-reset:hover{ text-decoration:underline; }
        .stock-stepper-row{
          display:flex;
          align-items:center;
          gap:20px;
        }
        .stock-stepper-btn{
          width:44px;
          height:44px;
          flex:0 0 auto;
          border:none;
          border-radius:999px;
          background:rgba(180,35,24,.1);
          color:#b42318;
          display:grid;
          place-items:center;
          cursor:pointer;
          transition:transform .12s var(--ease-out, ease), background .14s ease, opacity .14s ease;
        }
        .stock-stepper-btn.is-add{
          background:rgba(22,163,74,.1);
          color:#15803d;
        }
        .stock-stepper-btn:hover:not(:disabled){ filter:brightness(0.97); }
        .stock-stepper-btn:active:not(:disabled){ transform:scale(.9); }
        .stock-stepper-btn:disabled{ opacity:.35; cursor:not-allowed; }
        .stock-stepper-input{
          width:120px;
          border:none;
          background:transparent;
          outline:none;
          text-align:center;
          font-size:44px;
          font-weight:800;
          letter-spacing:-.02em;
          color:var(--color-ink, #1d1d1f);
          font-variant-numeric:tabular-nums;
          -moz-appearance:textfield;
        }
        .stock-stepper-input::-webkit-inner-spin-button,
        .stock-stepper-input::-webkit-outer-spin-button{
          -webkit-appearance:none;
          margin:0;
        }
        .stock-stepper-foot{
          display:flex;
          align-items:center;
          gap:8px;
          font-size:12.5px;
          font-weight:600;
          color:var(--color-graphite, #707070);
        }
        .stock-stepper-nudges{
          display:flex;
          align-items:center;
          gap:6px;
          margin-top:2px;
        }
        .stock-nudge-chip{
          height:28px;
          padding:0 12px;
          border-radius:999px;
          border:1px solid rgba(29,29,31,.08);
          background:#fff;
          color:var(--color-graphite, #707070);
          font-size:12px;
          font-weight:700;
          cursor:pointer;
          transition:transform .12s var(--ease-out, ease), border-color .14s ease, color .14s ease, background .14s ease;
        }
        .stock-nudge-chip:hover{
          border-color:rgba(0,113,227,.24);
          color:var(--color-azure, #0071e3);
          background:rgba(0,113,227,.05);
        }
        .stock-nudge-chip:active{ transform:scale(.93); }
        .stock-view-all-btn{
          width:100%;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:8px;
          margin-top:12px;
          padding:10px 12px;
          border:none;
          border-top:1px solid rgba(29,29,31,.07);
          border-radius:0 0 10px 10px;
          background:transparent;
          color:var(--color-azure, #0071e3);
          font-size:12.5px;
          font-weight:700;
          font-family:inherit;
          cursor:pointer;
          transition:background .14s ease, transform .12s var(--ease-out, ease);
        }
        .stock-view-all-btn svg{ transition:transform .14s var(--ease-out, ease); }
        .stock-view-all-btn:hover{ background:rgba(0,113,227,.06); }
        .stock-view-all-btn:hover svg{ transform:translateX(2px); }
        .stock-view-all-btn:active{ transform:scale(.98); }
        @media (prefers-reduced-motion: reduce){
          .stock-stepper-btn,
          .stock-nudge-chip,
          .stock-view-all-btn,
          .stock-view-all-btn svg{ transition:none!important; }
        }
      `}</style>
    </ModalOverlay>
  );
}
