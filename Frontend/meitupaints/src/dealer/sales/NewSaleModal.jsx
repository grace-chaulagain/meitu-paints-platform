import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  useGetDealerInventoryQuery,
  useCreateDealerSaleMutation,
} from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { GhostButton, Pill, PrimaryButton, SectionHeader, Spinner, Surface } from "../../components/dashboard/DashboardUI.jsx";

const MODAL_EASE_OUT = [0.23, 1, 0.32, 1];
const MIN_QUANTITY = 0.0001;

function CloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="factory-ui-close-btn"
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        border: "none",
        background: "var(--color-fog, #f5f5f7)",
        color: "var(--color-graphite, #707070)",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        transition: "transform .14s var(--ease-out, ease), background .14s ease",
      }}
    >
      <DashboardIcon name="close" size={14} strokeWidth={2} />
    </button>
  );
}

function CardLabel({ icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <DashboardIcon name={icon} size={13} strokeWidth={1.9} style={{ color: "var(--color-graphite, #707070)" }} />
      <span className="new-sale-card-label">{children}</span>
    </div>
  );
}

function QuantityStepper({ value, max, onChange }) {
  function clamp(next) {
    return Math.min(max, Math.max(MIN_QUANTITY, next));
  }

  return (
    <div className="new-sale-stepper">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= MIN_QUANTITY}
        aria-label="Decrease quantity"
        className="new-sale-stepper-btn"
      >
        <DashboardIcon name="minus" size={12} strokeWidth={2.4} />
      </button>
      <input
        type="number"
        min={MIN_QUANTITY}
        max={max}
        value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value || 0)))}
        className="new-sale-stepper-input"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label="Increase quantity"
        className="new-sale-stepper-btn"
      >
        <DashboardIcon name="plus" size={12} strokeWidth={2.4} />
      </button>
    </div>
  );
}

// Search-only picker for a line's product identity, embedded directly in the
// line's own card (mirrors the admin Amend Order card's ProductSearchPicker) -
// only searches this dealer's own on-hand stock, and excludes whatever's
// already picked on other lines so the same product can't be added twice.
function ProductPicker({ excludeIds, onSelect, onCancel, onRemove }) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const inventoryQuery = useGetDealerInventoryQuery({ q: trimmed, status: "ALL", limit: 100 }, { skip: trimmed.length < 2 });
  const results = (inventoryQuery.data?.items || []).filter((item) => !excludeIds.has(item.productId));

  return (
    <Surface padding={14} style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <CardLabel icon="search">Search Your Stock</CardLabel>
        <div style={{ display: "flex", gap: 8 }}>
          {onCancel ? <GhostButton onClick={onCancel}>Cancel</GhostButton> : null}
          <GhostButton danger icon="trash" onClick={onRemove}>
            Remove
          </GhostButton>
        </div>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by product name, SKU, or pack…"
        className="new-sale-input"
        autoFocus
      />

      {trimmed.length < 2 ? (
        <div className="new-sale-hint">Type at least 2 characters to search your inventory.</div>
      ) : inventoryQuery.isFetching ? (
        <div className="new-sale-hint">Searching…</div>
      ) : results.length === 0 ? (
        <div className="new-sale-hint">No matching products in your stock.</div>
      ) : (
        <div style={{ display: "grid", gap: 6, maxHeight: 220, overflow: "auto" }}>
          {results.slice(0, 20).map((item) => (
            <button
              key={item.productId}
              type="button"
              disabled={item.currentQuantity <= 0}
              onClick={() => onSelect(item)}
              className="new-sale-option-row"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, opacity: item.currentQuantity <= 0 ? 0.5 : 1 }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </div>
                <div style={{ marginTop: 1, fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>{item.pack?.label || item.category}</div>
              </div>
              <Pill tone={item.currentQuantity <= 0 ? "critical" : "neutral"} size="small">
                {item.currentQuantity <= 0 ? "Out of stock" : `${item.currentQuantity} on hand`}
              </Pill>
            </button>
          ))}
        </div>
      )}
    </Surface>
  );
}

// One self-contained card per line - either the embedded search picker
// (no product chosen yet, or "Change" was clicked) or the compact
// quantity view, exactly the two-state pattern the admin Amend Order
// card's LineEditor already established.
function ProductLineCard({ line, otherProductIds, onSelectProduct, onUpdateQuantity, onRemove }) {
  const [searching, setSearching] = useState(!line.productId);

  if (searching) {
    return (
      <ProductPicker
        excludeIds={otherProductIds}
        onRemove={onRemove}
        onCancel={line.productId ? () => setSearching(false) : null}
        onSelect={(item) => {
          onSelectProduct(item);
          setSearching(false);
        }}
      />
    );
  }

  return (
    <Surface padding={14} style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 12, alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {line.name}
          </div>
          <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>
              {line.sku}{line.packLabel ? ` · ${line.packLabel}` : ""}
            </span>
            <button type="button" onClick={() => setSearching(true)} className="new-sale-change-link">
              Change
            </button>
          </div>
        </div>

        <QuantityStepper value={line.quantity} max={line.availableQuantity} onChange={onUpdateQuantity} />

        <GhostButton danger icon="trash" onClick={onRemove}>
          Remove
        </GhostButton>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <span className="new-sale-available-tag">Available {line.availableQuantity}</span>
      </div>
    </Surface>
  );
}

export default function NewSaleModal({ open, onClose, onCreated }) {
  const [billId, setBillId] = useState("");
  const [lineItems, setLineItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const nextLocalId = useRef(0);

  const [createSale, createState] = useCreateDealerSaleMutation();

  function resetAndClose() {
    setBillId("");
    setLineItems([]);
    setNotes("");
    setError("");
    onClose();
  }

  function addBlankLine() {
    nextLocalId.current += 1;
    setLineItems((prev) => [
      {
        localId: nextLocalId.current,
        productId: null,
        name: "",
        sku: "",
        packLabel: "",
        quantity: 1,
        availableQuantity: 0,
      },
      ...prev,
    ]);
  }

  function selectProductForLine(localId, item) {
    setLineItems((prev) =>
      prev.map((line) =>
        line.localId === localId
          ? {
              ...line,
              productId: item.productId,
              name: item.name,
              sku: item.sku,
              packLabel: item.pack?.label || "",
              quantity: Math.min(line.quantity || 1, item.currentQuantity || 0) || 1,
              availableQuantity: item.currentQuantity,
            }
          : line,
      ),
    );
  }

  function updateQuantity(localId, quantity) {
    setLineItems((prev) => prev.map((line) => (line.localId === localId ? { ...line, quantity } : line)));
  }

  function removeLine(localId) {
    setLineItems((prev) => prev.filter((line) => line.localId !== localId));
  }

  async function handleSubmit() {
    setError("");
    if (!billId.trim()) {
      setError("Enter the Bill ID for this sale.");
      return;
    }
    if (lineItems.length === 0) {
      setError("Add at least one product.");
      return;
    }
    if (lineItems.some((line) => !line.productId)) {
      setError("Every line needs a product selected from your stock.");
      return;
    }
    if (lineItems.some((line) => Number(line.quantity) <= 0)) {
      setError("Every product needs a quantity greater than zero.");
      return;
    }

    try {
      const sale = await createSale({
        billId: billId.trim(),
        items: lineItems.map((line) => ({
          productId: line.productId,
          sku: line.sku,
          name: line.name,
          packLabel: line.packLabel,
          quantity: Number(line.quantity),
        })),
        notes,
      }).unwrap();
      onCreated?.(sale);
      resetAndClose();
    } catch (err) {
      setError(getQueryErrorMessage(err, "Could not record this sale."));
    }
  }

  const shouldReduceMotion = useReducedMotion();
  const scale = shouldReduceMotion ? 1 : 0.95;
  const fast = shouldReduceMotion ? 0.001 : 0.16;
  const slow = shouldReduceMotion ? 0.001 : 0.22;
  const totalUnits = lineItems.reduce((sum, line) => sum + Number(line.quantity || 0), 0);

  return (
    <>
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
            zIndex: 1400,
            background: "rgba(0,0,0,.4)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "grid",
            placeItems: "center",
            padding: 24,
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) resetAndClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale }}
            transition={{ duration: slow, ease: MODAL_EASE_OUT }}
            style={{ transformOrigin: "center", width: "min(1040px, 100%)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <Surface style={{ width: "100%", maxHeight: "90vh", overflow: "auto" }} padding={24}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <SectionHeader icon="plus" title="New Sale" subtitle="Add products from your own stock, then enter the Bill ID." />
                <CloseButton onClick={resetAndClose} />
              </div>

              <div className="new-sale-modal-grid" style={{ marginTop: 20, display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(300px,.85fr)", gap: 18, alignItems: "start" }}>
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <CardLabel icon="package">Products</CardLabel>
                    <GhostButton icon="plus" onClick={addBlankLine}>
                      Add Product
                    </GhostButton>
                  </div>

                  {lineItems.length === 0 ? (
                    <div className="new-sale-empty-hint">No products added yet. Click "Add Product" to search your stock.</div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {lineItems.map((line) => {
                        const otherProductIds = new Set(
                          lineItems.filter((other) => other.localId !== line.localId && other.productId).map((other) => other.productId),
                        );
                        return (
                          <motion.div
                            key={line.localId}
                            layout
                            initial={{ opacity: 0, height: 0, scale: shouldReduceMotion ? 1 : 0.97 }}
                            animate={{ opacity: 1, height: "auto", scale: 1 }}
                            exit={{ opacity: 0, height: 0, scale: shouldReduceMotion ? 1 : 0.97 }}
                            transition={{ duration: shouldReduceMotion ? 0.001 : 0.22, ease: MODAL_EASE_OUT }}
                            style={{ overflow: "hidden" }}
                          >
                            <ProductLineCard
                              line={line}
                              otherProductIds={otherProductIds}
                              onSelectProduct={(item) => selectProductForLine(line.localId, item)}
                              onUpdateQuantity={(quantity) => updateQuantity(line.localId, quantity)}
                              onRemove={() => removeLine(line.localId)}
                            />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}
                </div>

                <div style={{ display: "grid", gap: 14 }}>
                  <Surface padding={16} style={{ background: "rgba(0,113,227,.06)" }}>
                    <div className="new-sale-summary-eyebrow">Sale Summary</div>
                    <div className="new-sale-summary-figure">
                      {totalUnits} unit{totalUnits === 1 ? "" : "s"}
                    </div>
                    <div className="new-sale-summary-meta">
                      {lineItems.length} product{lineItems.length === 1 ? "" : "s"} · {billId.trim() ? `Bill ${billId.trim()}` : "No Bill ID yet"}
                    </div>
                  </Surface>

                  <Surface padding={16} style={{ display: "grid", gap: 8 }}>
                    <CardLabel icon="user">Bill ID</CardLabel>
                    <input
                      value={billId}
                      onChange={(event) => setBillId(event.target.value)}
                      placeholder="Enter the physical bill/invoice number"
                      className="new-sale-input"
                      maxLength={60}
                    />
                  </Surface>

                  <Surface padding={16} style={{ display: "grid", gap: 8 }}>
                    <CardLabel icon="edit">Notes</CardLabel>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Optional note about this sale"
                      rows={3}
                      className="new-sale-textarea"
                    />
                  </Surface>
                </div>
              </div>

              {error ? <div className="new-sale-error" style={{ marginTop: 16 }}>{error}</div> : null}

              <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <GhostButton onClick={resetAndClose} disabled={createState.isLoading}>
                  Cancel
                </GhostButton>
                <PrimaryButton onClick={handleSubmit} disabled={createState.isLoading} style={{ height: 44 }}>
                  {createState.isLoading ? <Spinner /> : null}
                  {createState.isLoading ? "Recording…" : "Record Sale"}
                </PrimaryButton>
              </div>
            </Surface>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>

    <style>{`
        .new-sale-card-label{
          font-size:12px;
          font-weight:700;
          letter-spacing:.02em;
          color:var(--color-graphite, #707070);
        }
        .new-sale-summary-eyebrow{
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.06em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
        }
        .new-sale-summary-figure{
          margin-top:4px;
          font-size:24px;
          font-weight:700;
          color:var(--color-azure, #0071e3);
        }
        .new-sale-summary-meta{
          margin-top:3px;
          font-size:12px;
          font-weight:500;
          color:var(--color-graphite, #707070);
        }
        .new-sale-option-row{
          width:100%;
          text-align:left;
          padding:10px 12px;
          border-radius:12px;
          border:1px solid rgba(0,0,0,.06);
          background:#fff;
          cursor:pointer;
          transition:background .14s ease, border-color .14s ease;
        }
        .new-sale-option-row:hover:not(:disabled){
          background:rgba(0,113,227,.045);
          border-color:rgba(0,113,227,.16);
        }
        .new-sale-option-row:disabled{
          cursor:not-allowed;
        }
        .new-sale-change-link{
          border:none;
          background:transparent;
          color:var(--color-azure, #0071e3);
          font-size:11.5px;
          font-weight:700;
          cursor:pointer;
          padding:0;
        }
        .new-sale-input{
          width:100%;
          height:40px;
          border-radius:10px;
          border:1px solid rgba(0,0,0,.1);
          padding:0 12px;
          font-size:13.5px;
          font-family:inherit;
          background:#fff;
        }
        .new-sale-input:focus-visible{
          outline:2px solid rgba(0,113,227,.36);
          outline-offset:1px;
        }
        .new-sale-hint{
          font-size:12px;
          font-weight:500;
          color:var(--color-graphite, #707070);
        }
        .new-sale-empty-hint{
          padding:20px;
          border-radius:16px;
          background:var(--color-fog, #f5f5f7);
          text-align:center;
          font-size:12.5px;
          font-weight:600;
          color:var(--color-graphite, #707070);
        }
        .new-sale-available-tag{
          font-size:11px;
          font-weight:600;
          letter-spacing:.02em;
          color:var(--color-graphite, #707070);
        }
        .new-sale-stepper{
          display:flex;
          align-items:center;
          gap:6px;
          background:var(--color-fog, #f5f5f7);
          border-radius:999px;
          padding:3px;
        }
        .new-sale-stepper-btn{
          width:26px;
          height:26px;
          border-radius:999px;
          border:none;
          background:transparent;
          color:var(--color-ink, #1d1d1f);
          display:grid;
          place-items:center;
          cursor:pointer;
          transition:background .14s ease, transform .14s var(--ease-out, ease);
        }
        .new-sale-stepper-btn:hover:not(:disabled){
          background:rgba(0,113,227,.1);
          color:var(--color-azure, #0071e3);
        }
        .new-sale-stepper-btn:active:not(:disabled){
          transform:scale(.88);
        }
        .new-sale-stepper-btn:disabled{
          opacity:.35;
          cursor:not-allowed;
        }
        .new-sale-stepper-input{
          width:40px;
          height:26px;
          border:none;
          background:transparent;
          text-align:center;
          font-size:13px;
          font-weight:700;
          color:var(--color-ink, #1d1d1f);
          -moz-appearance:textfield;
        }
        .new-sale-stepper-input::-webkit-outer-spin-button,
        .new-sale-stepper-input::-webkit-inner-spin-button{
          -webkit-appearance:none;
          margin:0;
        }
        .new-sale-stepper-input:focus-visible{
          outline:none;
        }
        .new-sale-textarea{
          width:100%;
          border-radius:12px;
          border:1px solid rgba(0,0,0,.1);
          padding:10px 12px;
          font-size:13px;
          font-family:inherit;
          resize:vertical;
          background:#fff;
        }
        .new-sale-textarea:focus-visible{
          outline:2px solid rgba(0,113,227,.36);
          outline-offset:1px;
        }
        .new-sale-error{
          padding:12px 14px;
          border-radius:12px;
          background:rgba(180,35,24,.08);
          color:#b42318;
          font-size:12.5px;
          font-weight:600;
        }
        @media (max-width:760px){
          .new-sale-modal-grid{
            grid-template-columns:1fr!important;
          }
        }
      `}</style>
    </>
  );
}
