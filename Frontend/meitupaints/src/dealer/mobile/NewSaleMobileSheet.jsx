import { useRef, useState } from "react";
import { useGetDealerInventoryQuery, useCreateDealerSaleMutation } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { MobileSheet } from "./MobileSheet.jsx";
import { PrimaryButton } from "./PrimaryButton.jsx";
import { QuantityStepper } from "./QuantityStepper.jsx";
import { toast } from "./useToast.js";
import { playCompletion } from "./completionFeedback.js";

// Search-only picker for a line's product identity, embedded directly in
// the line's own card - mirrors the desktop NewSaleModal's ProductPicker
// (same query/exclude-already-picked logic), just mobile markup.
function ProductPicker({ excludeIds, onSelect, onCancel, onRemove }) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const inventoryQuery = useGetDealerInventoryQuery({ q: trimmed, status: "ALL", limit: 100 }, { skip: trimmed.length < 2 });
  const results = (inventoryQuery.data?.items || []).filter((item) => !excludeIds.has(item.productId));

  return (
    <div className="dealer-m-newsale-line">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your stock…"
        className="dealer-m-newsale-input"
        autoFocus
      />
      {trimmed.length < 2 ? (
        <div className="dealer-m-newsale-hint">Type at least 2 characters to search.</div>
      ) : inventoryQuery.isFetching ? (
        <div className="dealer-m-newsale-hint">Searching…</div>
      ) : results.length === 0 ? (
        <div className="dealer-m-newsale-hint">No matching products in your stock.</div>
      ) : (
        <div className="dealer-m-newsale-results">
          {results.slice(0, 20).map((item) => (
            <button
              key={item.productId}
              type="button"
              disabled={item.currentQuantity <= 0}
              onClick={() => onSelect(item)}
              className="dealer-m-newsale-result-row"
            >
              <span className="dealer-m-newsale-result-name">{item.name}</span>
              <span className="dealer-m-newsale-result-qty">
                {item.currentQuantity <= 0 ? "Out of stock" : `${item.currentQuantity} on hand`}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="dealer-m-newsale-line-actions">
        {onCancel ? (
          <button type="button" className="dealer-m-newsale-ghost" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="button" className="dealer-m-newsale-ghost danger" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}

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
    <div className="dealer-m-newsale-line">
      <div className="dealer-m-newsale-line-head">
        <span className="dealer-m-newsale-line-name">{line.name}</span>
        <button type="button" className="dealer-m-newsale-change" onClick={() => setSearching(true)}>
          Change
        </button>
      </div>
      <div className="dealer-m-newsale-line-sub">
        {line.sku}
        {line.packLabel ? ` · ${line.packLabel}` : ""} · Available {line.availableQuantity}
      </div>
      <div className="dealer-m-newsale-line-row">
        <QuantityStepper value={line.quantity} onChange={onUpdateQuantity} min={1} max={line.availableQuantity} size={36} />
        <button type="button" className="dealer-m-newsale-remove" onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}

// Spec §4.2: NewSaleModal becomes a bottom sheet on mobile (MobileSheet,
// height="full"). Submit shows an in-button AppleSpinner (PrimaryButton's
// own `loading` prop); on success the sheet dismisses, then a toast +
// playCompletion() fire - both AFTER resetAndClose so the sheet's own exit
// transition isn't fighting the toast's entrance for attention.
export function NewSaleMobileSheet({ open, onClose, onCreated }) {
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
      { localId: nextLocalId.current, productId: null, name: "", sku: "", packLabel: "", quantity: 1, availableQuantity: 0 },
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
      toast("Sale recorded", { icon: "checkmark" });
      playCompletion();
    } catch (err) {
      setError(getQueryErrorMessage(err, "Could not record this sale."));
    }
  }

  const totalUnits = lineItems.reduce((sum, line) => sum + Number(line.quantity || 0), 0);

  return (
    <MobileSheet
      open={open}
      onClose={resetAndClose}
      ariaLabel="New sale"
      height="full"
      footer={
        <PrimaryButton onClick={handleSubmit} loading={createState.isLoading}>
          {totalUnits > 0 ? `Record sale — ${totalUnits} unit${totalUnits === 1 ? "" : "s"}` : "Record sale"}
        </PrimaryButton>
      }
    >
      <div className="dealer-m-newsale-title">New Sale</div>

      <div className="dealer-m-newsale-field-label">Bill ID</div>
      <input
        value={billId}
        onChange={(e) => setBillId(e.target.value)}
        placeholder="Enter the physical bill/invoice number"
        className="dealer-m-newsale-input"
        maxLength={60}
      />

      <div className="dealer-m-newsale-products-head">
        <div className="dealer-m-newsale-field-label">Products</div>
        <button type="button" className="dealer-m-newsale-add" onClick={addBlankLine}>
          + Add product
        </button>
      </div>

      {lineItems.length === 0 ? (
        <div className="dealer-m-newsale-empty">No products added yet. Tap &quot;Add product&quot; to search your stock.</div>
      ) : (
        <div className="dealer-m-newsale-lines">
          {lineItems.map((line) => {
            const otherProductIds = new Set(
              lineItems.filter((other) => other.localId !== line.localId && other.productId).map((other) => other.productId),
            );
            return (
              <ProductLineCard
                key={line.localId}
                line={line}
                otherProductIds={otherProductIds}
                onSelectProduct={(item) => selectProductForLine(line.localId, item)}
                onUpdateQuantity={(quantity) => updateQuantity(line.localId, quantity)}
                onRemove={() => removeLine(line.localId)}
              />
            );
          })}
        </div>
      )}

      <div className="dealer-m-newsale-field-label">Notes (optional)</div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional note about this sale"
        rows={3}
        className="dealer-m-newsale-textarea"
      />

      {error ? <div className="dealer-m-newsale-error">{error}</div> : null}
    </MobileSheet>
  );
}
