import { useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import {
  useGetStockHistoryQuery,
  useUpdateStockQuantityMutation,
  useUpdateStockThresholdMutation,
} from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { GhostButton, PrimaryButton, SectionHeader, SegmentedControl } from "../../components/dashboard/DashboardUI.jsx";
import { AppleDropdown } from "../../components/dashboard/ApplePickers.jsx";
import { Banner, CloseButton, ModalOverlay, MovementBadge } from "../factoryUI.jsx";
import { STOCK_REASONS, compactDate, fieldInputStyle } from "../factoryHelpers.js";

const EDIT_MODES = [
  { key: "quick", label: "Quick" },
  { key: "exact", label: "Exact" },
];

const REASON_OPTIONS = STOCK_REASONS.map((item) => ({ key: item, label: item }));

export default function FactoryStockEditModal({ product, onClose }) {
  const [newStock, setNewStock] = useState(product?.stock?.currentQuantity || 0);
  const [threshold, setThreshold] = useState(product?.stock?.lowStockThreshold || 0);
  const [editMode, setEditMode] = useState("quick");
  const [customDelta, setCustomDelta] = useState(1);
  const [reason, setReason] = useState("Manual Count");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const [updateStock, stockState] = useUpdateStockQuantityMutation();
  const [updateThreshold, thresholdState] = useUpdateStockThresholdMutation();
  const historyQuery = useGetStockHistoryQuery(
    product ? { productId: product.productId || product._id, limit: 10, onlyMovements: "true" } : skipToken,
  );

  if (!product) return null;

  const current = Number(product.stock?.currentQuantity || 0);
  const next = Number(newStock || 0);
  const delta = next - current;
  const thresholdChanged = Number(threshold) !== Number(product.stock?.lowStockThreshold || 0);
  const hasChange = delta !== 0 || thresholdChanged;
  const saving = stockState.isLoading || thresholdState.isLoading;

  function applyDelta(amount) {
    setConfirming(false);
    setNewStock((value) => Math.max(0, Number(value || 0) + Number(amount || 0)));
  }

  function resetStock() {
    setConfirming(false);
    setNewStock(current);
    setThreshold(product.stock?.lowStockThreshold || 0);
    setCustomDelta(1);
  }

  async function save() {
    setError("");
    if (!hasChange) {
      setError("No stock or threshold changes to save.");
      return;
    }
    if (!Number.isFinite(next) || next < 0) {
      setError("Stock cannot be negative.");
      return;
    }
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

  return (
    <ModalOverlay open={Boolean(product)} onClose={onClose} maxWidth={640}>
      <div style={{ display: "grid", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <SectionHeader
            eyebrow={[product.sku, product.packLabel || product.pack?.label].filter(Boolean).join(" · ")}
            icon="stock"
            title={product.name}
          />
          <CloseButton onClick={onClose} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            padding: "20px 22px",
            borderRadius: 20,
            background: "var(--color-fog, #f5f5f7)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", color: "var(--color-ink, #1d1d1f)" }}>{current}</div>
              <div style={{ marginTop: 2, fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
                Current
              </div>
            </div>
            <span style={{ fontSize: 20, fontWeight: 300, color: "var(--color-graphite, #707070)", opacity: 0.55 }} aria-hidden="true">
              →
            </span>
            <div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", color: "var(--color-azure, #0071e3)" }}>{next}</div>
              <div style={{ marginTop: 2, fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
                New
              </div>
            </div>
          </div>
          {delta !== 0 ? <MovementBadge delta={delta} /> : null}
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              Quick controls for receiving stock, or exact count after a manual count.
            </span>
            <SegmentedControl options={EDIT_MODES} value={editMode} onChange={setEditMode} size="small" />
          </div>

          {editMode === "quick" ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
                {[-10, -5, -1, 1, 5, 10].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => applyDelta(amount)}
                    style={{
                      height: 36,
                      borderRadius: 999,
                      border: "none",
                      background: amount < 0 ? "rgba(180,35,24,.08)" : "rgba(22,163,74,.08)",
                      color: amount < 0 ? "#b42318" : "#15803d",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    {amount > 0 ? `+${amount}` : amount}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="number"
                  min="1"
                  value={customDelta}
                  onChange={(event) => setCustomDelta(event.target.value)}
                  style={{ ...fieldInputStyle(), width: 90 }}
                />
                <GhostButton onClick={() => applyDelta(-Number(customDelta || 0))}>Remove</GhostButton>
                <GhostButton onClick={() => applyDelta(Number(customDelta || 0))}>Add</GhostButton>
              </div>
            </div>
          ) : (
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Exact stock count</span>
              <input
                type="number"
                min="0"
                value={newStock}
                onChange={(event) => {
                  setConfirming(false);
                  setNewStock(event.target.value);
                }}
                style={fieldInputStyle()}
              />
            </label>
          )}
          <div>
            <GhostButton onClick={resetStock}>Reset to current stock</GhostButton>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Reason</span>
            <AppleDropdown value={reason} options={REASON_OPTIONS} onChange={setReason} />
          </label>
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
        </div>
        <label style={{ display: "grid", gap: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Notes</span>
          <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} style={{ ...fieldInputStyle(), height: "auto", padding: 10, resize: "vertical" }} />
        </label>

        {Math.abs(delta) >= 100 ? <Banner tone="error">Large stock adjustment — review before confirming.</Banner> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}

        {confirming ? (
          <div style={{ display: "grid", gap: 8, padding: 16, borderRadius: 14, background: "rgba(0,113,227,.06)" }}>
            <strong style={{ fontSize: 13, color: "var(--color-ink, #1d1d1f)" }}>
              Change {product.name} stock from {current} to {next}?
            </strong>
            <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
              Difference {delta >= 0 ? `+${delta}` : delta} · Reason: {reason}
              {thresholdChanged ? ` · Threshold ${product.stock?.lowStockThreshold || 0} → ${threshold}` : ""}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <GhostButton onClick={() => setConfirming(false)}>Back</GhostButton>
              <PrimaryButton icon="checkmark" onClick={save} disabled={saving || !hasChange}>
                {saving ? "Saving…" : "Confirm Save"}
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <GhostButton onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton onClick={() => setConfirming(true)} disabled={!hasChange}>
              Review Change
            </PrimaryButton>
          </div>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
            Recent Audit
          </span>
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
        </div>
      </div>
    </ModalOverlay>
  );
}
