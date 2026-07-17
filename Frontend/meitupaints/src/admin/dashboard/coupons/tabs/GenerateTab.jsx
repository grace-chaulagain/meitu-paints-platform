import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  clearLastGeneratedBatch,
  selectLastGeneratedBatch,
  setLastGeneratedBatch,
} from "../../../../redux/couponBatchSlice.js";
import {
  useGenerateCouponsMutation,
  useGetAdminPointsCatalogProductsQuery,
  useGetRewardSettingsQuery,
  useUpdateRewardSettingsMutation,
} from "../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../redux/api/selectors.js";
import { downloadCouponPrintAssets } from "../../../../utils/downloadCouponPrintAssets.js";
import { couponTypeLabel, exportProgressLabel, exportProgressPercent, formatDateOnly, formatMoney } from "../couponFormatting.js";

// This tab is a deliberate visual island - a "print bureau" for minting
// coupon batches, built entirely from scratch (no Surface/Pill/AppleDropdown/
// etc. from the shared dashboard kit) rather than a reskin of the old
// dropdown-stack form. Every class below is namespaced `composer-*` so
// nothing here can collide with or inherit from the shared admin styles.
const EASE_OUT = [0.23, 1, 0.32, 1];

function Glyph({ name, size = 16 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "chevron") return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
  if (name === "close") return <svg {...common}><path d="M18 6 6 18M6 6l12 12" /></svg>;
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "minus") return <svg {...common}><path d="M5 12h14" /></svg>;
  if (name === "check") return <svg {...common}><path d="m5 13 4 4L19 7" /></svg>;
  if (name === "download") return <svg {...common}><path d="M12 3v13m0 0-4-4m4 4 4-4M4 20h16" /></svg>;
  if (name === "stamp") return <svg {...common}><path d="M9 3h6l1 5H8l1-5Z" /><path d="M6 12h12l1 4H5l1-4ZM4 20h16" /></svg>;
  if (name === "dial") return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>;
  return null;
}

function Spinner() {
  return <span className="composer-spinner" aria-hidden="true" />;
}

function addMonthsIso(months) {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

const EXPIRY_PRESETS = [
  { key: "6m", label: "6 months", months: 6 },
  { key: "1y", label: "1 year", months: 12 },
  { key: "2y", label: "2 years", months: 24 },
];

const QUANTITY_PRESETS = [10, 50, 100, 500, 1000, 5000];

// Weight-factor editor for the "payout rate" knob - a slide-down strip
// instead of the old anchored popover card, tucked under a small text
// trigger in the header rather than a bare gear icon.
function PayoutRateEditor({ value, onToast }) {
  const [updateSettings, updateState] = useUpdateRewardSettingsMutation();
  const [draft, setDraft] = useState(String(value ?? ""));
  const isDirty = draft !== String(value ?? "");

  async function handleSave() {
    const parsed = Number(draft);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      onToast({ tone: "error", title: "Invalid payout rate", description: "Enter a whole number greater than 0." });
      return;
    }
    try {
      await updateSettings({ weightFactor: parsed }).unwrap();
      onToast({ tone: "success", title: "Payout rate updated", description: `Cash = points × ${parsed}` });
    } catch (err) {
      onToast({ tone: "error", title: "Could not save", description: getQueryErrorMessage(err, "Failed to update reward settings.") });
    }
  }

  return (
    <div className="composer-rate-editor">
      <span className="composer-rate-times">×</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ""))}
        className="composer-rate-input"
      />
      <span className="composer-rate-caption">cash per point</span>
      {isDirty ? (
        <button type="button" className="composer-rate-save" onClick={handleSave} disabled={updateState.isLoading || !draft}>
          {updateState.isLoading ? <Spinner /> : <Glyph name="check" size={13} />}
        </button>
      ) : null}
    </div>
  );
}

// The confirm step: a bottom sheet instead of a centered modal - this
// creates real, redeemable cash liability, so it stays a deliberate second
// step, just re-skinned to match the ticket-press language of the rest of
// the page.
function ConfirmSheet({ open, summary, weightFactor, saving, error, onClose, onConfirm }) {
  const shouldReduceMotion = useReducedMotion();
  const totalLiability = Number(summary.points || 0) * Number(weightFactor || 0) * Number(summary.quantity || 0);
  const quantityValue = Number(summary.quantity || 0);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="composer-sheet-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.001 : 0.2 }}
            onClick={() => !saving && onClose()}
          />
          <motion.div
            className="composer-sheet"
            role="dialog"
            aria-modal="true"
            initial={{ y: shouldReduceMotion ? 0 : "100%", opacity: shouldReduceMotion ? 0 : 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: shouldReduceMotion ? 0 : "100%", opacity: shouldReduceMotion ? 0 : 1, transition: { duration: shouldReduceMotion ? 0.001 : 0.22, ease: "easeIn" } }}
            transition={{ duration: shouldReduceMotion ? 0.001 : 0.38, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="composer-sheet-handle" aria-hidden="true" />
            <div className="composer-sheet-title">Confirm this batch</div>
            <div className="composer-sheet-subtitle">This mints real, redeemable cash liability. Review before printing.</div>

            <div className="composer-sheet-rows">
              <div className="composer-sheet-row">
                <span>Product</span>
                <strong>{summary.productName}{summary.size ? ` · ${summary.size}` : ""}</strong>
              </div>
              <div className="composer-sheet-row">
                <span>Coupon type</span>
                <strong className={summary.type === "GOLDEN" ? "is-gold" : "is-emerald"}>{couponTypeLabel(summary.type)}</strong>
              </div>
              <div className="composer-sheet-row">
                <span>Points per coupon</span>
                <strong className="composer-mono">{summary.points}</strong>
              </div>
              <div className="composer-sheet-row">
                <span>Quantity</span>
                <strong className="composer-mono">{summary.quantity}</strong>
              </div>
              <div className="composer-sheet-row">
                <span>Expires</span>
                <strong>{formatDateOnly(summary.expiresAt)}</strong>
              </div>
              <div className="composer-sheet-row composer-sheet-total">
                <span>Total cash liability</span>
                <strong className="composer-mono">{formatMoney(totalLiability)}</strong>
              </div>
            </div>

            {error ? <div className="composer-alert">{error}</div> : null}

            <div className="composer-sheet-actions">
              <button type="button" className="composer-ghost-btn" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="composer-primary-btn" onClick={onConfirm} disabled={saving}>
                {saving ? <Spinner /> : <Glyph name="stamp" size={15} />}
                {saving ? "Printing…" : `Print ${quantityValue} coupon${quantityValue === 1 ? "" : "s"}`}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export default function GenerateTab({ onToast }) {
  const shouldReduceMotion = useReducedMotion();
  const [category, setCategory] = useState("");
  const [schemeProductId, setSchemeProductId] = useState("");
  const [size, setSize] = useState("");
  const [expiresAt, setExpiresAt] = useState(() => addMonthsIso(12));
  const [customExpiryOpen, setCustomExpiryOpen] = useState(false);
  const [quantity, setQuantity] = useState("10");
  const [formError, setFormError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [rateOpen, setRateOpen] = useState(false);

  const dispatch = useDispatch();
  const batch = useSelector(selectLastGeneratedBatch);
  const [generateCoupons, generateState] = useGenerateCouponsMutation();
  const settingsQuery = useGetRewardSettingsQuery();
  const weightFactor = settingsQuery.data?.weightFactor ?? null;
  const catalogQuery = useGetAdminPointsCatalogProductsQuery({ limit: 500 });
  const catalogLoading = catalogQuery.isLoading;

  const catalogProducts = useMemo(
    () => (catalogQuery.data?.items || []).filter((product) => product.isActive !== false),
    [catalogQuery.data],
  );

  const categories = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const product of catalogProducts) {
      if (!seen.has(product.category)) {
        seen.add(product.category);
        list.push(product.category);
      }
    }
    return list;
  }, [catalogProducts]);

  const productsInCategory = useMemo(
    () => catalogProducts.filter((product) => product.category === category),
    [catalogProducts, category],
  );

  const selectedProduct = useMemo(
    () => catalogProducts.find((product) => product._id === schemeProductId) || null,
    [catalogProducts, schemeProductId],
  );

  const resolvedPoints = !selectedProduct
    ? null
    : selectedProduct.pricingMode === "FLAT"
      ? selectedProduct.flatPoints
      : selectedProduct.sizes.find((entry) => entry.size === size)?.points ?? null;
  const resolvedType = selectedProduct?.couponType || null;

  const quantityValue = Number(quantity) || 0;
  const liveTotal = resolvedPoints != null ? Number(resolvedPoints) * Number(weightFactor || 0) * quantityValue : 0;

  const activeExpiryPreset = EXPIRY_PRESETS.find((preset) => addMonthsIso(preset.months) === expiresAt)?.key || null;
  const isCustomExpiry = !activeExpiryPreset;

  function pickCategory(next) {
    setCategory(next === category ? "" : next);
    setSchemeProductId("");
    setSize("");
  }

  function pickProduct(product) {
    setSchemeProductId(product._id === schemeProductId ? "" : product._id);
    setSize("");
  }

  function pickExpiryPreset(preset) {
    setCustomExpiryOpen(false);
    setExpiresAt(addMonthsIso(preset.months));
  }

  function nudgeQuantity(delta) {
    setQuantity((prev) => String(Math.min(5000, Math.max(1, (Number(prev) || 0) + delta))));
  }

  async function handleExport() {
    setExporting(true);
    setExportProgress({ phase: "render", done: 0, total: batch.coupons.length });
    try {
      await downloadCouponPrintAssets({
        coupons: batch.coupons,
        batchId: batch.batchId,
        onProgress: setExportProgress,
      });
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  }

  function handlePrintAnother() {
    dispatch(clearLastGeneratedBatch());
    setCategory("");
    setSchemeProductId("");
    setSize("");
  }

  function handleReview() {
    setFormError("");

    if (!category) {
      setFormError("Pick a category to begin.");
      return;
    }
    if (!selectedProduct) {
      setFormError("Pick a product.");
      return;
    }
    if (selectedProduct.pricingMode === "SIZES" && !size) {
      setFormError("Pick a size.");
      return;
    }
    if (!Number.isFinite(quantityValue) || quantityValue < 1 || quantityValue > 5000) {
      setFormError("Quantity must be between 1 and 5000.");
      return;
    }
    if (!expiresAt) {
      setFormError("Choose an expiry.");
      return;
    }

    setConfirmError("");
    setConfirmOpen(true);
  }

  async function handleConfirmGenerate() {
    setConfirmError("");
    try {
      const result = await generateCoupons({
        schemeProductId,
        size: selectedProduct.pricingMode === "SIZES" ? size : undefined,
        expiresAt: new Date(expiresAt).toISOString(),
        quantity: quantityValue,
      }).unwrap();
      dispatch(setLastGeneratedBatch(result));
      setConfirmOpen(false);
      onToast({
        tone: "success",
        title: `${result.coupons.length} coupon${result.coupons.length === 1 ? "" : "s"} printed`,
        description: `${couponTypeLabel(resolvedType)} · ${formatMoney(result.coupons.length * Number(resolvedPoints) * (weightFactor || 0))} total liability`,
      });
    } catch (err) {
      setConfirmError(getQueryErrorMessage(err, "Failed to generate coupons."));
    }
  }

  const catalogError = catalogQuery.error ? getQueryErrorMessage(catalogQuery.error, "Failed to load the product catalog.") : "";
  const canGenerate = Boolean(selectedProduct) && (selectedProduct?.pricingMode !== "SIZES" || Boolean(size)) && quantityValue > 0 && weightFactor != null;

  return (
    <div className="composer-page">
      <div className="composer-header">
        <div>
          <h1>Print a new batch</h1>
          <p>Pick a product, set the terms, and mint redeemable coupons.</p>
        </div>
        <div className="composer-rate-anchor">
          <button type="button" className={`composer-rate-trigger${rateOpen ? " is-open" : ""}`} onClick={() => setRateOpen((v) => !v)}>
            <Glyph name="dial" size={14} />
            Payout rate
            <Glyph name="chevron" size={12} />
          </button>
          <AnimatePresence>
            {rateOpen ? (
              <>
                <div className="composer-rate-scrim" onClick={() => setRateOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : -8, scale: shouldReduceMotion ? 1 : 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -6, scale: shouldReduceMotion ? 1 : 0.98 }}
                  transition={{ duration: shouldReduceMotion ? 0.001 : 0.16, ease: EASE_OUT }}
                  className="composer-rate-panel"
                >
                  {settingsQuery.data?.weightFactor != null ? (
                    <PayoutRateEditor value={settingsQuery.data.weightFactor} onToast={onToast} />
                  ) : (
                    <div className="composer-rate-skeleton" />
                  )}
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {!batch ? (
        <motion.div
          className="composer-stage"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.001 : 0.46, ease: EASE_OUT }}
        >
          <div className="composer-section">
            <div className="composer-section-label">Category</div>
            <div className="composer-chip-rail">
              {catalogLoading ? (
                <>
                  <span className="composer-chip-skeleton" />
                  <span className="composer-chip-skeleton" />
                  <span className="composer-chip-skeleton" />
                </>
              ) : categories.length ? (
                categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`composer-chip${category === cat ? " is-active" : ""}`}
                    onClick={() => pickCategory(cat)}
                  >
                    {cat}
                  </button>
                ))
              ) : (
                <span className="composer-empty-hint">No catalog products yet — add one in Catalog.</span>
              )}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {category ? (
              <motion.div
                key="products"
                initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: shouldReduceMotion ? 0.001 : 0.32, ease: EASE_OUT }}
                className="composer-section-collapse"
              >
                <div className="composer-section" style={{ paddingTop: 4 }}>
                  <div className="composer-section-label">Product</div>
                  <div className="composer-tile-grid">
                    {productsInCategory.map((product) => (
                      <button
                        key={product._id}
                        type="button"
                        className={`composer-tile${schemeProductId === product._id ? " is-active" : ""}`}
                        onClick={() => pickProduct(product)}
                      >
                        <span className={`composer-dot${product.couponType === "GOLDEN" ? " is-gold" : " is-emerald"}`} />
                        <span className="composer-tile-name">{product.name}</span>
                        <span className="composer-tile-meta">
                          {product.pricingMode === "FLAT"
                            ? `${product.flatPoints} pts flat`
                            : `${product.sizes.length} size${product.sizes.length === 1 ? "" : "s"}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {selectedProduct?.pricingMode === "SIZES" ? (
              <motion.div
                key="sizes"
                initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: shouldReduceMotion ? 0.001 : 0.28, ease: EASE_OUT }}
                className="composer-section-collapse"
              >
                <div className="composer-section" style={{ paddingTop: 4 }}>
                  <div className="composer-section-label">Size</div>
                  <div className="composer-chip-rail">
                    {selectedProduct.sizes.map((entry) => (
                      <button
                        key={entry.size}
                        type="button"
                        className={`composer-chip is-size${size === entry.size ? " is-active" : ""}`}
                        onClick={() => setSize(entry.size)}
                      >
                        {entry.size} <em>{entry.points} pts</em>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {selectedProduct?.pricingMode === "FLAT" && selectedProduct.rule ? (
            <div className="composer-rule-note">
              <Glyph name="stamp" size={13} />
              {selectedProduct.rule}
            </div>
          ) : null}

          <div className="composer-split">
            <div className={`composer-ticket${selectedProduct ? " is-filled" : ""}${resolvedType === "GOLDEN" ? " is-gold" : ""}`}>
              <div className="composer-ticket-main">
                <AnimatePresence mode="wait">
                  {selectedProduct ? (
                    <motion.div
                      key={selectedProduct._id}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: shouldReduceMotion ? 0.001 : 0.2, ease: EASE_OUT }}
                    >
                      <span className={`composer-type-badge${resolvedType === "GOLDEN" ? " is-gold" : " is-emerald"}`}>
                        {couponTypeLabel(resolvedType)}
                      </span>
                      <div className="composer-ticket-name">
                        {selectedProduct.name}
                        {size ? ` · ${size}` : ""}
                      </div>
                      <div className="composer-ticket-category">{selectedProduct.category}</div>
                      <div className="composer-ticket-metric">
                        <span>Points / coupon</span>
                        <strong className="composer-mono">{resolvedPoints ?? "—"}</strong>
                      </div>
                      <div className="composer-ticket-metric">
                        <span>Valid until</span>
                        <strong>{formatDateOnly(expiresAt)}</strong>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={shouldReduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="composer-ticket-empty"
                    >
                      <Glyph name="stamp" size={22} />
                      <div>Pick a product to start filling this ticket</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="composer-ticket-perforation" aria-hidden="true">
                <span className="composer-notch composer-notch-top" />
                <span className="composer-notch composer-notch-bottom" />
              </div>

              <div className="composer-ticket-stub">
                <div className="composer-stub-block">
                  <span className="composer-stub-label">Qty</span>
                  <div className="composer-stepper">
                    <button type="button" onClick={() => nudgeQuantity(-1)} aria-label="Decrease quantity">
                      <Glyph name="minus" size={12} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="5000"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      className="composer-stepper-input composer-mono"
                    />
                    <button type="button" onClick={() => nudgeQuantity(1)} aria-label="Increase quantity">
                      <Glyph name="plus" size={12} />
                    </button>
                  </div>
                </div>
                <div className="composer-stub-block">
                  <span className="composer-stub-label">Total liability</span>
                  <strong className="composer-mono composer-stub-total">{formatMoney(liveTotal)}</strong>
                </div>
              </div>
            </div>

            <div className="composer-schedule">
              <div className="composer-section-label">Quantity presets</div>
              <div className="composer-chip-rail is-wrap">
                {QUANTITY_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`composer-chip is-compact${Number(quantity) === preset ? " is-active" : ""}`}
                    onClick={() => setQuantity(String(preset))}
                  >
                    {preset.toLocaleString()}
                  </button>
                ))}
              </div>

              <div className="composer-section-label" style={{ marginTop: 16 }}>Expiry</div>
              <div className="composer-chip-rail is-wrap">
                {EXPIRY_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className={`composer-chip is-compact${activeExpiryPreset === preset.key && !customExpiryOpen ? " is-active" : ""}`}
                    onClick={() => pickExpiryPreset(preset)}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`composer-chip is-compact${customExpiryOpen || isCustomExpiry ? " is-active" : ""}`}
                  onClick={() => setCustomExpiryOpen((v) => !v)}
                >
                  Custom
                </button>
              </div>
              <AnimatePresence initial={false}>
                {customExpiryOpen || isCustomExpiry ? (
                  <motion.div
                    initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: shouldReduceMotion ? 0.001 : 0.22, ease: EASE_OUT }}
                    style={{ overflow: "hidden" }}
                  >
                    <input
                      type="date"
                      value={expiresAt}
                      onChange={(event) => setExpiresAt(event.target.value)}
                      className="composer-date-input"
                      style={{ marginTop: 10 }}
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {catalogError ? <div className="composer-alert">{catalogError}</div> : null}
              {formError ? <div className="composer-alert">{formError}</div> : null}

              <button type="button" className="composer-generate-dock" disabled={!canGenerate} onClick={handleReview}>
                <span>Print {quantityValue > 0 ? quantityValue.toLocaleString() : ""} coupon{quantityValue === 1 ? "" : "s"}</span>
                <Glyph name="stamp" size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          className="composer-stage composer-success"
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: shouldReduceMotion ? 0.001 : 0.4, ease: EASE_OUT }}
        >
          <motion.div
            className="composer-stamp-icon"
            initial={shouldReduceMotion ? false : { scale: 0.6, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ duration: shouldReduceMotion ? 0.001 : 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <Glyph name="check" size={26} />
          </motion.div>
          <div className="composer-success-title">{batch.coupons.length} coupon{batch.coupons.length === 1 ? "" : "s"} printed</div>
          <div className="composer-success-subtitle">SVG + PNG per coupon, plus a manifest.csv — ready for the print vendor.</div>

          {exporting ? (
            <div className="composer-export-progress">
              <div className="composer-export-track">
                <div className="composer-export-fill" style={{ width: `${exportProgressPercent(exportProgress)}%` }} />
              </div>
              <div className="composer-export-label">{exportProgressLabel(exportProgress)}</div>
            </div>
          ) : (
            <div className="composer-success-actions">
              <button type="button" className="composer-ghost-btn" onClick={handlePrintAnother}>
                Print another
              </button>
              <button type="button" className="composer-primary-btn" onClick={handleExport}>
                <Glyph name="download" size={15} />
                Download ZIP
              </button>
            </div>
          )}
        </motion.div>
      )}

      <ConfirmSheet
        open={confirmOpen}
        summary={{
          productName: selectedProduct?.name || "",
          size: selectedProduct?.pricingMode === "SIZES" ? size : "",
          type: resolvedType,
          points: resolvedPoints,
          quantity,
          expiresAt,
        }}
        weightFactor={weightFactor}
        saving={generateState.isLoading}
        error={confirmError}
        onClose={() => {
          if (!generateState.isLoading) setConfirmOpen(false);
        }}
        onConfirm={handleConfirmGenerate}
      />

      <style>{`
        .composer-page{
          --composer-bg: #0a0a0e;
          --composer-panel: #15151d;
          --composer-panel-raise: #1b1b25;
          --composer-ink: #f5f3ee;
          --composer-muted: #92909e;
          --composer-line: rgba(245,243,238,.1);
          --composer-gold: #f0b429;
          --composer-emerald: #34d399;
          display:grid;
          gap:18px;
        }
        .composer-mono{
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-variant-numeric: tabular-nums;
        }

        .composer-header{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:16px;
          flex-wrap:wrap;
        }
        .composer-header h1{
          margin:0;
          font-size:26px;
          font-weight:800;
          letter-spacing:-.03em;
          color:var(--color-ink, #1d1d1f);
        }
        .composer-header p{
          margin:4px 0 0;
          font-size:13.5px;
          color:var(--color-graphite, #707070);
        }

        .composer-rate-anchor{ position:relative; flex-shrink:0; }
        .composer-rate-trigger{
          display:inline-flex;
          align-items:center;
          gap:6px;
          height:34px;
          padding:0 12px;
          border-radius:999px;
          border:1px solid rgba(29,29,31,.12);
          background:#fff;
          color:var(--color-graphite, #707070);
          font-size:12.5px;
          font-weight:650;
          cursor:pointer;
          transition:background .14s ease, color .14s ease, border-color .14s ease;
        }
        .composer-rate-trigger:hover, .composer-rate-trigger.is-open{
          color:var(--color-ink, #1d1d1f);
          border-color:rgba(29,29,31,.22);
        }
        .composer-rate-scrim{ position:fixed; inset:0; z-index:40; }
        .composer-rate-panel{
          position:absolute;
          top:calc(100% + 8px);
          right:0;
          z-index:50;
          width:230px;
          padding:14px;
          border-radius:16px;
          background:var(--composer-panel, #15151d);
          border:1px solid var(--composer-line, rgba(245,243,238,.1));
          box-shadow:0 20px 48px rgba(0,0,0,.4);
        }
        .composer-rate-editor{
          display:flex;
          align-items:center;
          gap:8px;
        }
        .composer-rate-times{ font-size:18px; font-weight:800; color:var(--composer-gold, #f0b429); }
        .composer-rate-input{
          flex:1 1 auto;
          min-width:0;
          border:none;
          background:transparent;
          font-size:18px;
          font-weight:800;
          font-variant-numeric:tabular-nums;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          color:var(--composer-ink, #f5f3ee);
          outline:none;
        }
        .composer-rate-caption{ font-size:10px; color:var(--composer-muted, #92909e); white-space:nowrap; }
        .composer-rate-save{
          flex-shrink:0;
          width:26px;
          height:26px;
          border:none;
          border-radius:999px;
          background:var(--composer-gold, #f0b429);
          color:#1a1305;
          display:grid;
          place-items:center;
          cursor:pointer;
          transition:transform .14s ${EASE_OUT.join(",")};
        }
        .composer-rate-save:active{ transform:scale(.9); }
        .composer-rate-save:disabled{ opacity:.5; cursor:not-allowed; }
        .composer-rate-skeleton{ height:24px; border-radius:8px; background:rgba(245,243,238,.08); }

        .composer-stage{
          border-radius:32px;
          background:radial-gradient(ellipse 900px 400px at 10% 0%, rgba(240,180,41,.08), transparent 60%), var(--composer-bg, #0a0a0e);
          border:1px solid rgba(245,243,238,.06);
          padding:26px;
          display:grid;
          gap:20px;
          color:var(--composer-ink, #f5f3ee);
        }

        .composer-section{ display:grid; gap:10px; }
        .composer-section-label{
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.08em;
          text-transform:uppercase;
          color:var(--composer-muted, #92909e);
        }
        .composer-section-collapse{ overflow:hidden; }

        .composer-chip-rail{
          display:flex;
          align-items:center;
          gap:8px;
          overflow-x:auto;
          scrollbar-width:none;
          padding-bottom:2px;
        }
        .composer-chip-rail::-webkit-scrollbar{ display:none; }
        .composer-chip-rail.is-wrap{ flex-wrap:wrap; overflow-x:visible; }

        .composer-chip{
          flex:0 0 auto;
          height:38px;
          padding:0 16px;
          border-radius:999px;
          border:1px solid var(--composer-line, rgba(245,243,238,.1));
          background:transparent;
          color:var(--composer-ink, #f5f3ee);
          font-size:13px;
          font-weight:650;
          font-family:inherit;
          cursor:pointer;
          transition:background .16s ease, border-color .16s ease, color .16s ease, transform .14s ${EASE_OUT.join(",")};
        }
        .composer-chip em{ font-style:normal; opacity:.65; margin-left:4px; }
        .composer-chip:hover{ border-color:rgba(245,243,238,.28); }
        .composer-chip:active{ transform:scale(.96); }
        .composer-chip.is-active{
          background:var(--composer-gold, #f0b429);
          border-color:var(--composer-gold, #f0b429);
          color:#1a1305;
        }
        .composer-chip.is-size.is-active{ background:var(--composer-emerald, #34d399); border-color:var(--composer-emerald, #34d399); color:#052e1c; }
        .composer-chip.is-compact{ height:32px; padding:0 13px; font-size:12.5px; }

        .composer-chip-skeleton{
          flex:0 0 auto;
          width:96px;
          height:38px;
          border-radius:999px;
          background:linear-gradient(90deg, rgba(245,243,238,.05), rgba(245,243,238,.12), rgba(245,243,238,.05));
        }
        .composer-empty-hint{ font-size:13px; color:var(--composer-muted, #92909e); }

        .composer-tile-grid{
          display:grid;
          grid-template-columns:repeat(auto-fill, minmax(170px, 1fr));
          gap:8px;
        }
        .composer-tile{
          display:grid;
          gap:6px;
          padding:12px 14px;
          border-radius:16px;
          border:1px solid var(--composer-line, rgba(245,243,238,.1));
          background:var(--composer-panel, #15151d);
          color:var(--composer-ink, #f5f3ee);
          text-align:left;
          cursor:pointer;
          transition:border-color .16s ease, background .16s ease, transform .14s ${EASE_OUT.join(",")};
        }
        .composer-tile:hover{ border-color:rgba(245,243,238,.24); }
        .composer-tile:active{ transform:scale(.98); }
        .composer-tile.is-active{
          border-color:var(--composer-gold, #f0b429);
          background:var(--composer-panel-raise, #1b1b25);
          box-shadow:0 0 0 1px var(--composer-gold, #f0b429) inset;
        }
        .composer-dot{ width:8px; height:8px; border-radius:999px; }
        .composer-dot.is-gold{ background:var(--composer-gold, #f0b429); }
        .composer-dot.is-emerald{ background:var(--composer-emerald, #34d399); }
        .composer-tile-name{ font-size:13.5px; font-weight:700; }
        .composer-tile-meta{ font-size:11.5px; color:var(--composer-muted, #92909e); }

        .composer-rule-note{
          display:flex;
          align-items:flex-start;
          gap:8px;
          padding:10px 14px;
          border-radius:14px;
          background:rgba(240,180,41,.08);
          border:1px solid rgba(240,180,41,.18);
          color:var(--composer-gold, #f0b429);
          font-size:12px;
          line-height:1.5;
        }

        .composer-split{
          display:grid;
          grid-template-columns:minmax(0, 1fr) minmax(220px, .62fr);
          gap:18px;
          align-items:start;
        }

        .composer-ticket{
          display:grid;
          grid-template-columns:1fr auto 148px;
          min-height:220px;
          border-radius:22px;
          background:var(--composer-panel, #15151d);
          border:1px solid var(--composer-line, rgba(245,243,238,.1));
          overflow:hidden;
          transition:border-color .2s ease;
        }
        .composer-ticket.is-filled{ border-color:rgba(245,243,238,.18); }
        .composer-ticket.is-filled.is-gold{ border-color:rgba(240,180,41,.4); }
        .composer-ticket-main{
          padding:22px;
          display:flex;
          flex-direction:column;
          justify-content:center;
          min-width:0;
        }
        .composer-ticket-empty{
          display:flex;
          flex-direction:column;
          align-items:flex-start;
          gap:10px;
          color:var(--composer-muted, #92909e);
          font-size:13px;
          max-width:260px;
        }
        .composer-type-badge{
          display:inline-flex;
          width:fit-content;
          height:24px;
          align-items:center;
          padding:0 12px;
          border-radius:999px;
          font-size:11px;
          font-weight:800;
          letter-spacing:.02em;
        }
        .composer-type-badge.is-gold{ background:rgba(240,180,41,.16); color:var(--composer-gold, #f0b429); }
        .composer-type-badge.is-emerald{ background:rgba(52,211,153,.16); color:var(--composer-emerald, #34d399); }
        .composer-ticket-name{ margin-top:10px; font-size:20px; font-weight:800; letter-spacing:-.02em; }
        .composer-ticket-category{ margin-top:2px; font-size:12px; color:var(--composer-muted, #92909e); }
        .composer-ticket-metric{
          margin-top:12px;
          display:flex;
          align-items:baseline;
          gap:8px;
          font-size:12px;
          color:var(--composer-muted, #92909e);
        }
        .composer-ticket-metric strong{ font-size:15px; color:var(--composer-ink, #f5f3ee); font-weight:800; }

        .composer-ticket-perforation{
          position:relative;
          width:1px;
          background-image:repeating-linear-gradient(to bottom, var(--composer-line, rgba(245,243,238,.1)) 0 6px, transparent 6px 12px);
        }
        .composer-notch{
          position:absolute;
          left:50%;
          width:20px;
          height:20px;
          border-radius:999px;
          background:var(--composer-bg, #0a0a0e);
          transform:translateX(-50%);
        }
        .composer-notch-top{ top:-10px; }
        .composer-notch-bottom{ bottom:-10px; }

        .composer-ticket-stub{
          padding:20px 16px;
          display:flex;
          flex-direction:column;
          justify-content:center;
          gap:18px;
          background:var(--composer-panel-raise, #1b1b25);
        }
        .composer-stub-block{ display:grid; gap:6px; }
        .composer-stub-label{ font-size:10px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--composer-muted, #92909e); }
        .composer-stub-total{ font-size:19px; color:var(--composer-gold, #f0b429); }

        .composer-stepper{
          display:flex;
          align-items:center;
          gap:6px;
        }
        .composer-stepper button{
          width:24px;
          height:24px;
          flex-shrink:0;
          border:1px solid var(--composer-line, rgba(245,243,238,.1));
          border-radius:8px;
          background:transparent;
          color:var(--composer-ink, #f5f3ee);
          display:grid;
          place-items:center;
          cursor:pointer;
          transition:background .14s ease, transform .14s ${EASE_OUT.join(",")};
        }
        .composer-stepper button:hover{ background:rgba(245,243,238,.08); }
        .composer-stepper button:active{ transform:scale(.9); }
        .composer-stepper-input{
          width:56px;
          border:none;
          background:transparent;
          font-size:17px;
          font-weight:800;
          color:var(--composer-ink, #f5f3ee);
          outline:none;
        }

        .composer-schedule{ display:grid; align-content:start; gap:4px; }

        .composer-date-input{
          width:100%;
          height:40px;
          border-radius:12px;
          border:1px solid var(--composer-line, rgba(245,243,238,.1));
          background:var(--composer-panel, #15151d);
          color:var(--composer-ink, #f5f3ee);
          padding:0 12px;
          font-size:13px;
          font-family:inherit;
          color-scheme:dark;
        }

        .composer-alert{
          margin-top:12px;
          padding:10px 13px;
          border-radius:12px;
          background:rgba(220,38,38,.12);
          border:1px solid rgba(220,38,38,.28);
          color:#fca5a5;
          font-size:12.5px;
          font-weight:600;
        }

        .composer-generate-dock{
          margin-top:16px;
          display:flex;
          align-items:center;
          justify-content:center;
          gap:9px;
          width:100%;
          height:52px;
          border-radius:999px;
          border:none;
          background:var(--composer-gold, #f0b429);
          color:#1a1305;
          font-size:14.5px;
          font-weight:800;
          cursor:pointer;
          transition:transform .16s ${EASE_OUT.join(",")}, filter .16s ease, opacity .16s ease;
        }
        .composer-generate-dock:hover:not(:disabled){ filter:brightness(1.06); transform:translateY(-1px); }
        .composer-generate-dock:active:not(:disabled){ transform:scale(.98); }
        .composer-generate-dock:disabled{ opacity:.35; cursor:not-allowed; }

        .composer-ghost-btn{
          height:44px;
          padding:0 18px;
          border-radius:999px;
          border:1px solid var(--composer-line, rgba(245,243,238,.14));
          background:transparent;
          color:var(--composer-ink, #f5f3ee);
          font-size:13.5px;
          font-weight:700;
          cursor:pointer;
          transition:background .14s ease, transform .14s ${EASE_OUT.join(",")};
        }
        .composer-ghost-btn:hover:not(:disabled){ background:rgba(245,243,238,.08); }
        .composer-ghost-btn:active:not(:disabled){ transform:scale(.97); }
        .composer-ghost-btn:disabled{ opacity:.4; cursor:not-allowed; }

        .composer-primary-btn{
          display:inline-flex;
          align-items:center;
          gap:8px;
          height:44px;
          padding:0 20px;
          border-radius:999px;
          border:none;
          background:var(--composer-gold, #f0b429);
          color:#1a1305;
          font-size:13.5px;
          font-weight:800;
          cursor:pointer;
          transition:transform .14s ${EASE_OUT.join(",")}, filter .14s ease;
        }
        .composer-primary-btn:hover:not(:disabled){ filter:brightness(1.06); }
        .composer-primary-btn:active:not(:disabled){ transform:scale(.97); }
        .composer-primary-btn:disabled{ opacity:.5; cursor:not-allowed; }

        .composer-spinner{
          width:14px;
          height:14px;
          border-radius:999px;
          border:2px solid rgba(0,0,0,.25);
          border-top-color:rgba(0,0,0,.75);
          display:inline-block;
          animation:composerSpin .7s linear infinite;
        }
        @keyframes composerSpin{ to{ transform:rotate(360deg); } }

        .composer-sheet-scrim{
          position:fixed;
          inset:0;
          z-index:1400;
          background:rgba(4,4,6,.6);
          backdrop-filter:blur(6px);
          -webkit-backdrop-filter:blur(6px);
        }
        .composer-sheet{
          position:fixed;
          left:50%;
          bottom:0;
          transform:translateX(-50%);
          z-index:1401;
          width:min(520px, calc(100vw - 32px));
          max-height:min(86vh, 640px);
          overflow-y:auto;
          padding:22px 24px 26px;
          border-radius:28px 28px 0 0;
          background:var(--composer-panel, #15151d);
          border:1px solid var(--composer-line, rgba(245,243,238,.12));
          border-bottom:none;
          color:var(--composer-ink, #f5f3ee);
        }
        .composer-sheet-handle{
          width:40px;
          height:4px;
          border-radius:999px;
          background:rgba(245,243,238,.2);
          margin:0 auto 16px;
        }
        .composer-sheet-title{ font-size:18px; font-weight:800; letter-spacing:-.01em; }
        .composer-sheet-subtitle{ margin-top:4px; font-size:12.5px; color:var(--composer-muted, #92909e); }
        .composer-sheet-rows{
          margin-top:16px;
          display:grid;
          gap:11px;
          padding:14px 16px;
          border-radius:16px;
          background:var(--composer-panel-raise, #1b1b25);
        }
        .composer-sheet-row{
          display:flex;
          align-items:center;
          justify-content:space-between;
          font-size:13px;
        }
        .composer-sheet-row span{ color:var(--composer-muted, #92909e); }
        .composer-sheet-row strong{ font-weight:700; }
        .composer-sheet-row strong.is-gold{ color:var(--composer-gold, #f0b429); }
        .composer-sheet-row strong.is-emerald{ color:var(--composer-emerald, #34d399); }
        .composer-sheet-total{ padding-top:10px; border-top:1px solid var(--composer-line, rgba(245,243,238,.1)); }
        .composer-sheet-total strong{ font-size:18px; color:var(--composer-gold, #f0b429); }
        .composer-sheet-actions{
          margin-top:18px;
          display:flex;
          gap:10px;
          justify-content:flex-end;
        }

        .composer-success{
          align-items:center;
          text-align:center;
          padding:48px 26px;
        }
        .composer-stamp-icon{
          width:56px;
          height:56px;
          border-radius:999px;
          display:grid;
          place-items:center;
          background:rgba(52,211,153,.14);
          color:var(--composer-emerald, #34d399);
          margin:0 auto;
        }
        .composer-success-title{ margin-top:16px; font-size:19px; font-weight:800; }
        .composer-success-subtitle{ margin-top:4px; font-size:13px; color:var(--composer-muted, #92909e); }
        .composer-success-actions{ margin-top:22px; display:flex; gap:10px; justify-content:center; }

        .composer-export-progress{ margin-top:22px; width:min(320px, 100%); margin-inline:auto; }
        .composer-export-track{
          width:100%;
          height:6px;
          border-radius:999px;
          background:rgba(245,243,238,.12);
          overflow:hidden;
        }
        .composer-export-fill{
          height:100%;
          border-radius:999px;
          background:linear-gradient(90deg, var(--composer-gold, #f0b429), #ffd873);
          transition:width .2s ease;
        }
        .composer-export-label{ margin-top:8px; font-size:11.5px; color:var(--composer-muted, #92909e); }

        @media (max-width:900px){
          .composer-split{ grid-template-columns:1fr; }
          .composer-ticket{ grid-template-columns:1fr auto 120px; }
        }
        @media (max-width:640px){
          .composer-stage{ padding:18px; border-radius:24px; }
          .composer-ticket{ grid-template-columns:1fr; }
          .composer-ticket-perforation{ display:none; }
          .composer-ticket-stub{ flex-direction:row; justify-content:space-between; }
        }

        @media (prefers-reduced-motion: reduce){
          .composer-chip, .composer-tile, .composer-generate-dock, .composer-primary-btn, .composer-ghost-btn, .composer-rate-save, .composer-stepper button{
            transition:none!important;
          }
          .composer-spinner{ animation:none!important; }
        }
      `}</style>
    </div>
  );
}
