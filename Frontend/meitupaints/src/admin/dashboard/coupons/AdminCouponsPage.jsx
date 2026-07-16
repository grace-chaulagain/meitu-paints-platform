import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import {
  clearLastGeneratedBatch,
  selectLastGeneratedBatch,
  setLastGeneratedBatch,
} from "../../../redux/couponBatchSlice.js";
import {
  useCreatePointsCatalogProductMutation,
  useDeleteCouponBatchMutation,
  useDeleteCouponBatchesMutation,
  useDeletePointsCatalogProductMutation,
  useGenerateCouponsMutation,
  useGetAdminCouponBatchesQuery,
  useGetAdminPointsCatalogProductsQuery,
  useGetCouponAttemptsQuery,
  useGetCouponRedemptionHistoryQuery,
  useGetRewardSettingsQuery,
  useGetSettlementReportQuery,
  useUpdatePointsCatalogProductMutation,
  useUpdateRewardSettingsMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  BulkActionBar,
  EmptyState,
  GhostButton,
  Pagination,
  Pill,
  PrimaryButton,
  SearchField,
  DashboardUIStyles,
  SectionHeader,
  Spinner,
  Surface,
  TabBar,
  ToggleSwitch,
} from "../../../components/dashboard/DashboardUI.jsx";
import { Toast } from "../../../components/dashboard/Toast.jsx";
import { AppleDateField, AppleDropdown } from "../../../components/dashboard/ApplePickers.jsx";
import ConfirmActionModal from "../../catalog/components/ConfirmActionModal.jsx";
import { downloadCouponPrintAssets } from "../../../utils/downloadCouponPrintAssets.js";

const TYPE_OPTIONS = [
  { key: "GOLDEN", label: "Golden Coupon" },
  { key: "GREEN", label: "Green Coupon" },
];

const HISTORY_TYPE_OPTIONS = [{ key: "ALL", label: "All types" }, ...TYPE_OPTIONS];

const COUPON_TABS = [
  {
    key: "generate",
    label: "Generate",
    subtitle: "Create batches",
    icon: "plus",
  },
  {
    key: "catalog",
    label: "Catalog",
    subtitle: "Reward rules",
    icon: "package",
  },
  {
    key: "coupons",
    label: "Batches",
    subtitle: "Generated sets",
    icon: "invoice",
  },
  {
    key: "history",
    label: "Redeemed",
    subtitle: "Coupon history",
    icon: "history",
  },
  {
    key: "attempts",
    label: "Security",
    subtitle: "Scan audit",
    icon: "shield",
  },
  {
    key: "settlement",
    label: "Payouts",
    subtitle: "Dealer payouts",
    icon: "chart",
  },
];

const COUPON_TAB_HINTS = {
  generate: "Create printable QR coupon batches.",
  catalog: "Manage reward rules and products.",
  coupons: "Open, export, or delete generated batches.",
  history: "Review successful dealer redemptions.",
  attempts: "Audit invalid or suspicious scans.",
  settlement: "Review dealer payout totals.",
};

const PRICING_MODE_OPTIONS = [
  { key: "SIZES", label: "Priced by size" },
  { key: "FLAT", label: "Flat points" },
];

const CATALOG_CATEGORY_ALL_OPTION = { key: "ALL", label: "All categories" };

const OUTCOME_OPTIONS = [
  { key: "ALL", label: "All outcomes" },
  { key: "SUCCESS", label: "Success" },
  { key: "INVALID", label: "Invalid" },
  { key: "EXPIRED", label: "Expired" },
  { key: "ALREADY_REDEEMED", label: "Already redeemed" },
  { key: "DEALER_NOT_APPROVED", label: "Dealer not approved" },
];

const COUPON_DATE_PRESETS = [
  { key: "ALL", label: "All time" },
  { key: "TODAY", label: "Today" },
  { key: "7D", label: "Last 7 days" },
  { key: "30D", label: "Last 30 days" },
  { key: "MONTH", label: "This month" },
  { key: "CUSTOM", label: "Custom range…" },
];

function outcomeTone(outcome) {
  if (outcome === "SUCCESS") return "positive";
  if (outcome === "ALREADY_REDEEMED") return "critical";
  return "caution";
}

const PAGE_SIZE = 20;

function formatMoney(value) {
  return `NPR ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatDateOnly(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTimeOnly(value) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function startOfDayIso(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function endOfDayIso(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

function resolveCouponDateRange(preset, customFrom, customTo) {
  const now = new Date();
  let from = "";
  let to = "";

  if (preset === "TODAY") {
    from = toDateInputValue(now);
    to = toDateInputValue(now);
  } else if (preset === "7D") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    from = toDateInputValue(start);
    to = toDateInputValue(now);
  } else if (preset === "30D") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    from = toDateInputValue(start);
    to = toDateInputValue(now);
  } else if (preset === "MONTH") {
    from = toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
    to = toDateInputValue(now);
  } else if (preset === "CUSTOM") {
    from = customFrom || "";
    to = customTo || "";
  }

  return {
    from: startOfDayIso(from),
    to: endOfDayIso(to),
  };
}

function formatDayKey(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDayDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatRelativeDayLabel(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (formatDayKey(date) === formatDayKey(today)) return "Today";
  if (formatDayKey(date) === formatDayKey(yesterday)) return "Yesterday";
  return null;
}

function groupRedemptionsByDay(items) {
  const groups = [];
  const indexByKey = new Map();

  items.forEach((item) => {
    const key = formatDayKey(item.redeemedAt);
    if (!indexByKey.has(key)) {
      indexByKey.set(key, groups.length);
      groups.push({
        key,
        relativeLabel: formatRelativeDayLabel(item.redeemedAt),
        dateText: formatDayDate(item.redeemedAt),
        items: [],
      });
    }
    groups[indexByKey.get(key)].items.push(item);
  });

  return groups;
}

function defaultExpiry() {
  const date = new Date();
  date.setDate(date.getDate() + 365);
  return date.toISOString().slice(0, 10);
}

function couponTypeLabel(type) {
  return type === "GOLDEN" ? "Golden Coupon" : "Green Coupon";
}

function redeemedPainterName(row) {
  if (row?.painterId?.name) return row.painterId.name;
  return "—";
}

function redeemedDealerName(row) {
  return row?.dealerId?.companyName || row?.dealerId?.contactName || "Unknown dealer";
}

function CouponRedemptionRow({ row }) {
  const golden = row.type === "GOLDEN";

  return (
    <article className="coupon-redemption-row">
      <div className={`coupon-redemption-icon${golden ? " is-golden" : ""}`} aria-hidden="true">
        <DashboardIcon name={golden ? "award" : "shield"} size={18} strokeWidth={1.8} />
      </div>

      <div className="coupon-redemption-main">
        <div className="coupon-redemption-title-row">
          <div className="coupon-redemption-code">{row.couponCode}</div>
        </div>
      </div>

      <div className="coupon-redemption-detail">
        <span className="coupon-redemption-detail-label">Dealer</span>
        <span className="coupon-redemption-detail-value">
          <DashboardIcon name="store" size={13} strokeWidth={1.8} />
          {redeemedDealerName(row)}
        </span>
      </div>

      <div className="coupon-redemption-detail">
        <span className="coupon-redemption-detail-label">Painter</span>
        <span className="coupon-redemption-detail-value">
          <DashboardIcon name="user" size={13} strokeWidth={1.8} />
          {redeemedPainterName(row)}
        </span>
      </div>

      <div className="coupon-redemption-detail">
        <span className="coupon-redemption-detail-label">Time</span>
        <span className="coupon-redemption-detail-value">
          <DashboardIcon name="calendar" size={13} strokeWidth={1.8} />
          {formatTimeOnly(row.redeemedAt)}
        </span>
      </div>

      <div className="coupon-redemption-metrics">
        <span className={`coupon-redemption-type${golden ? " is-golden" : ""}`}>{couponTypeLabel(row.type)}</span>
        <div className="coupon-redemption-points">
          <span>{Number(row.points || 0).toLocaleString()}</span>
          <small>points</small>
        </div>
        <div className="coupon-redemption-cash">{formatMoney(row.cashAmount)}</div>
      </div>
    </article>
  );
}

// Rendering (SVG+PNG per coupon) is the bulk of the work for a large batch,
// so it fills the first 90% of the bar; JSZip's own compression pass (the
// "zip" phase) fills the last 10% - keeps the bar moving smoothly through
// both phases instead of jumping/stalling between them.
function exportProgressPercent(progress) {
  if (!progress) return 0;
  if (progress.phase === "zip") return 90 + Math.round(Math.min(100, Math.max(0, progress.percent || 0)) * 0.1);
  if (progress.phase === "render" && progress.total) {
    return Math.round((progress.done / progress.total) * 90);
  }
  return 0;
}

function exportProgressLabel(progress) {
  if (!progress) return "Preparing…";
  if (progress.phase === "zip") return `Compressing ZIP · ${progress.percent || 0}%`;
  if (progress.phase === "render") return `Rendering ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()} coupons`;
  return "Preparing…";
}

// One cell in a responsive form grid - label-above-control, like Apple's own
// account/settings forms (System Settings > Wi-Fi details, Apple ID forms),
// rather than the label-left/control-right list rows SettingsRow renders.
// Used for the Generate tab's actual inputs (Category/Product/Size/Expires/
// Quantity); derived read-only summaries (Reward rule, Resolves to) pass
// `span` to stretch across the full grid width as a strip beneath the inputs.
function FieldCard({ icon, label, helper, children, span = false }) {
  return (
    <div className="coupon-field-card" style={span ? { gridColumn: "1 / -1" } : undefined}>
      <div className="coupon-field-label">
        {icon ? <DashboardIcon name={icon} size={12.5} strokeWidth={1.8} /> : null}
        {label}
      </div>
      <div className="coupon-field-control">{children}</div>
      {helper ? <div className="coupon-field-helper">{helper}</div> : null}
    </div>
  );
}

// One row inside the single Category -> Product -> Size "product card" -
// stacked with dividers rather than side-by-side cards, since the three are
// hierarchically dependent (category filters product; product determines
// whether a size step even exists). Product itself is visually the primary
// element (bigger icon badge, bigger accent-tinted control) since it's the
// actual decision being made; Category/Size are supporting context around it.
function ProductRow({ icon, label, children, primary = false, tone = "" }) {
  return (
    <div className={`coupon-product-row${primary ? " is-primary" : ""}${tone ? ` tone-${tone}` : ""}`}>
      <div className="coupon-product-row-head">
        <span className="coupon-product-icon">
          <DashboardIcon name={icon} size={primary ? 15 : 13} strokeWidth={1.8} />
        </span>
        <span className="coupon-product-eyebrow">{label}</span>
      </div>
      <div className="coupon-product-row-control">{children}</div>
    </div>
  );
}

// Mounted only once real settings data has loaded (see RewardSettingsPopover
// below), so `useState(String(initialValue))` seeds the editable draft
// correctly on first render - no effect-driven sync needed. The Save
// affordance only appears once the draft actually differs from the saved
// value - nothing to confirm when there's nothing changed. The weight factor
// is a whole-number multiplier (Cash = Points x N), so the input strips
// anything but digits on every keystroke rather than allowing decimals.
function RewardSettingsForm({ initialValue, onToast }) {
  const [updateSettings, updateState] = useUpdateRewardSettingsMutation();
  const [draft, setDraft] = useState(String(initialValue));
  const isDirty = draft !== String(initialValue);

  function handleChange(event) {
    setDraft(event.target.value.replace(/[^0-9]/g, ""));
  }

  async function handleSave() {
    const value = Number(draft);
    if (!Number.isInteger(value) || value <= 0) {
      onToast({ tone: "error", title: "Invalid weight factor", description: "Enter a whole number greater than 0." });
      return;
    }
    try {
      await updateSettings({ weightFactor: value }).unwrap();
      onToast({ tone: "success", title: "Reward weight factor updated", description: `Cash amount = Points × ${value}` });
    } catch (err) {
      onToast({ tone: "error", title: "Could not save", description: getQueryErrorMessage(err, "Failed to update reward settings.") });
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="coupon-weight-input-row">
        <span className="coupon-weight-prefix">×</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          onChange={handleChange}
          className="coupon-weight-input"
        />
      </div>
      {isDirty ? (
        <PrimaryButton onClick={handleSave} disabled={updateState.isLoading || !draft} style={{ width: "100%", height: 38 }}>
          {updateState.isLoading ? <Spinner size={13} /> : null}
          {updateState.isLoading ? "Saving…" : "Save"}
        </PrimaryButton>
      ) : null}
    </div>
  );
}

// Weight factor is now a settings popover anchored to a gear icon (rather
// than an always-visible card) - it's an admin-tuning knob touched rarely,
// so it shouldn't compete for attention with the actual Generate form.
function RewardSettingsPopover({ onToast }) {
  const settingsQuery = useGetRewardSettingsQuery();

  return (
    <div className="coupon-settings-popover dash-modal-surface-in">
      <div className="coupon-settings-popover-header">
        <DashboardIcon name="chart" size={13} strokeWidth={1.8} />
        Weight Factor (N)
      </div>
      <div className="coupon-settings-popover-helper">Cash amount = Points × N · applies to new coupons only</div>
      {settingsQuery.data?.weightFactor != null ? (
        <RewardSettingsForm initialValue={settingsQuery.data.weightFactor} onToast={onToast} />
      ) : (
        <div style={{ height: 46, borderRadius: 12, background: "var(--color-fog, #f5f5f7)" }} />
      )}
    </div>
  );
}

// Coupon generation creates real, redeemable cash liability - this modal is
// the one deliberate extra step in the flow, surfacing the computed total
// before it's committed (same pattern as any consequential financial
// action). Uses the shared dash-modal-* animation + layout convention.
function GenerateConfirmModal({ open, summary, weightFactor, saving, error, onClose, onConfirm }) {
  if (!open) return null;

  const totalLiability = Number(summary.points || 0) * Number(weightFactor || 0) * Number(summary.quantity || 0);
  const quantityValue = Number(summary.quantity || 0);

  return (
    <div
      className="dash-modal-backdrop-in"
      style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "grid", placeItems: "center", padding: 28 }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: "min(460px, 100%)" }} padding={22}>
        <SectionHeader
          icon="shield"
          title="Confirm coupon generation"
          subtitle="This creates real, redeemable cash liability. Review before continuing."
        />

        <div style={{ marginTop: 16, display: "grid", gap: 10, padding: 14, borderRadius: 14, background: "var(--color-fog, #f5f5f7)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "var(--color-graphite, #707070)" }}>Product</span>
            <span style={{ fontWeight: 700, textAlign: "right" }}>
              {summary.productName}
              {summary.size ? ` · ${summary.size}` : ""}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
            <span style={{ color: "var(--color-graphite, #707070)" }}>Coupon type</span>
            <Pill tone={summary.type === "GOLDEN" ? "caution" : "positive"} size="small">{couponTypeLabel(summary.type)}</Pill>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "var(--color-graphite, #707070)" }}>Points per coupon</span>
            <span style={{ fontWeight: 700 }}>{summary.points}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "var(--color-graphite, #707070)" }}>Quantity</span>
            <span style={{ fontWeight: 700 }}>{summary.quantity}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "var(--color-graphite, #707070)" }}>Expires</span>
            <span style={{ fontWeight: 700 }}>{formatDateOnly(summary.expiresAt)}</span>
          </div>
          <div style={{ marginTop: 4, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Total cash liability</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: "var(--color-azure, #0071e3)" }}>{formatMoney(totalLiability)}</span>
          </div>
        </div>

        {error ? <div className="admin-coupons-error" style={{ marginTop: 12 }}>{error}</div> : null}

        <div style={{ marginTop: 18, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <PrimaryButton onClick={onConfirm} disabled={saving}>
            {saving ? <Spinner /> : null}
            {saving ? "Generating…" : `Generate ${quantityValue} coupon${quantityValue === 1 ? "" : "s"}`}
          </PrimaryButton>
        </div>
      </Surface>
    </div>
  );
}

function GenerateTab({ onToast }) {
  const [category, setCategory] = useState("");
  const [schemeProductId, setSchemeProductId] = useState("");
  const [size, setSize] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);
  const [quantity, setQuantity] = useState("10");
  const [formError, setFormError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const categoryOptions = useMemo(() => {
    const seen = new Set();
    const options = [];
    for (const product of catalogProducts) {
      if (!seen.has(product.category)) {
        seen.add(product.category);
        options.push({ key: product.category, label: product.category });
      }
    }
    return options;
  }, [catalogProducts]);

  const productOptions = useMemo(
    () => catalogProducts.filter((product) => product.category === category).map((product) => ({ key: product._id, label: product.name })),
    [catalogProducts, category],
  );

  const selectedProduct = useMemo(
    () => catalogProducts.find((product) => product._id === schemeProductId) || null,
    [catalogProducts, schemeProductId],
  );

  const sizeOptions = useMemo(
    () =>
      selectedProduct?.pricingMode === "SIZES"
        ? selectedProduct.sizes.map((entry) => ({ key: entry.size, label: `${entry.size} · ${entry.points} pts` }))
        : [],
    [selectedProduct],
  );

  const resolvedPoints = !selectedProduct
    ? null
    : selectedProduct.pricingMode === "FLAT"
      ? selectedProduct.flatPoints
      : selectedProduct.sizes.find((entry) => entry.size === size)?.points ?? null;
  const resolvedType = selectedProduct?.couponType || null;

  function handleCategoryChange(next) {
    setCategory(next);
    setSchemeProductId("");
    setSize("");
  }

  function handleProductChange(next) {
    setSchemeProductId(next);
    setSize("");
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

  function handleGenerateAnother() {
    dispatch(clearLastGeneratedBatch());
    setCategory("");
    setSchemeProductId("");
    setSize("");
  }

  function handleReviewGenerate(event) {
    event.preventDefault();
    setFormError("");

    if (!category) {
      setFormError("Choose a product category.");
      return;
    }
    if (!selectedProduct) {
      setFormError("Choose a product.");
      return;
    }
    if (selectedProduct.pricingMode === "SIZES" && !size) {
      setFormError("Choose a size.");
      return;
    }
    const quantityValue = Number(quantity);
    if (!Number.isFinite(quantityValue) || quantityValue < 1 || quantityValue > 5000) {
      setFormError("Quantity must be between 1 and 5000.");
      return;
    }
    if (!expiresAt) {
      setFormError("Choose an expiry date.");
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
        quantity: Number(quantity),
      }).unwrap();
      dispatch(setLastGeneratedBatch(result));
      setConfirmOpen(false);
      onToast({
        tone: "success",
        title: `${result.coupons.length} coupon${result.coupons.length === 1 ? "" : "s"} generated`,
        description: `${couponTypeLabel(resolvedType)} · ${formatMoney(result.coupons.length * Number(resolvedPoints) * (weightFactor || 0))} total liability`,
      });
    } catch (err) {
      setConfirmError(getQueryErrorMessage(err, "Failed to generate coupons."));
    }
  }

  const catalogError = catalogQuery.error ? getQueryErrorMessage(catalogQuery.error, "Failed to load the product catalog.") : "";
  const liveEstimate = resolvedPoints != null ? Number(resolvedPoints) * Number(weightFactor || 0) * Number(quantity || 0) : 0;

  return (
    <div className="coupon-generate-layout">
      <form onSubmit={handleReviewGenerate} className="coupon-generate-form">
        <div className="coupon-generate-panel">
          <Surface padding={16}>
            <SectionHeader
              eyebrow="New Batch"
              title="Create coupons"
              subtitle="Choose product, expiry, and quantity. Review before anything is generated."
              size="small"
              action={
                <div className="coupon-settings-anchor">
                  <button
                    type="button"
                    className={`coupon-settings-btn${settingsOpen ? " is-active" : ""}`}
                    onClick={() => setSettingsOpen((value) => !value)}
                    aria-label="Reward settings"
                    title="Reward settings (weight factor)"
                  >
                    <DashboardIcon name="gear" size={15} strokeWidth={1.8} />
                  </button>
                  {settingsOpen ? (
                    <>
                      <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setSettingsOpen(false)} />
                      <RewardSettingsPopover onToast={onToast} />
                    </>
                  ) : null}
                </div>
              }
            />
            <div style={{ marginTop: 14 }}>
            <Surface padding={0} className="coupon-product-card">
              <ProductRow icon="store" label="Category">
                {catalogLoading ? (
                  <div className="coupon-field-skeleton" />
                ) : categoryOptions.length ? (
                  <AppleDropdown
                    value={category}
                    options={categoryOptions}
                    onChange={handleCategoryChange}
                    placeholder="Choose category"
                    style={{ width: "100%" }}
                  />
                ) : (
                  <span className="coupon-field-placeholder">No catalog products yet — add one in Catalog.</span>
                )}
              </ProductRow>

              <ProductRow icon="package" label="Product" primary>
                {catalogLoading ? (
                  <div className="coupon-field-skeleton" />
                ) : category ? (
                  <AppleDropdown
                    value={schemeProductId}
                    options={productOptions}
                    onChange={handleProductChange}
                    placeholder="Choose product"
                    style={{ width: "100%" }}
                  />
                ) : (
                  <div className="coupon-field-waiting">
                    <DashboardIcon name="package" size={13} strokeWidth={1.8} />
                    Select a category above to see products
                  </div>
                )}
              </ProductRow>

              {selectedProduct?.pricingMode === "SIZES" ? (
                <ProductRow icon="stock" label="Size">
                  <AppleDropdown value={size} options={sizeOptions} onChange={setSize} placeholder="Choose size" style={{ width: "100%" }} />
                </ProductRow>
              ) : null}

              {selectedProduct?.pricingMode === "FLAT" && selectedProduct.rule ? (
                <ProductRow icon="stock" label="Reward Rule">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Pill tone="accent" size="small">{selectedProduct.flatPoints} pts flat</Pill>
                    <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>{selectedProduct.rule}</span>
                  </div>
                </ProductRow>
              ) : null}
            </Surface>
            </div>
          </Surface>

          <div className="coupon-field-grid coupon-field-grid-meta">
            <div className={`coupon-preview-card${selectedProduct ? " is-filled" : ""}`}>
              {selectedProduct ? (
                <>
                  <div className="coupon-preview-head">
                    <span className="coupon-preview-icon">
                      <DashboardIcon name="package" size={15} strokeWidth={1.8} />
                    </span>
                    <div className="coupon-preview-title">
                      <div className="coupon-preview-name">{selectedProduct.name}</div>
                      <div className="coupon-preview-meta">
                        {selectedProduct.category}
                        {selectedProduct.pricingMode === "SIZES" && size ? ` · ${size}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="coupon-preview-stats">
                    <Pill tone={resolvedType === "GOLDEN" ? "caution" : "positive"} size="small">{couponTypeLabel(resolvedType)}</Pill>
                    <span className="coupon-preview-points">
                      {resolvedPoints != null ? `${resolvedPoints} pts per coupon` : "Choose a size to resolve points"}
                    </span>
                  </div>
                </>
              ) : (
                <div className="coupon-preview-empty">
                  <span className="coupon-preview-icon is-muted">
                    <DashboardIcon name="shield" size={15} strokeWidth={1.8} />
                  </span>
                  <div>
                    <div className="coupon-preview-empty-title">Coupon preview</div>
                    <div className="coupon-preview-empty-helper">Pick a product to see its coupon type and point value here.</div>
                  </div>
                </div>
              )}
            </div>

            <FieldCard icon="calendar" label="Expiry">
              <AppleDateField value={expiresAt} onChange={setExpiresAt} />
            </FieldCard>

            <FieldCard icon="package" label="Quantity" helper="Max 5000 per batch">
              <input
                type="number"
                min="1"
                max="5000"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="coupon-field-input"
              />
            </FieldCard>
          </div>
        </div>

        <div className="admin-coupons-cta-bar">
          <div>
            <div className="admin-coupons-cta-label">Estimated liability</div>
            <div className="admin-coupons-cta-value">{formatMoney(liveEstimate)}</div>
          </div>
          <PrimaryButton type="submit" disabled={weightFactor == null}>
            Review &amp; Generate
          </PrimaryButton>
        </div>
        {catalogError ? <div className="admin-coupons-error">{catalogError}</div> : null}
        {formError ? <div className="admin-coupons-error">{formError}</div> : null}
      </form>

      {batch ? (
        <Surface
          padding={20}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
            background: "linear-gradient(145deg, rgba(22,163,74,.07), rgba(255,255,255,.7))",
            border: "1px solid rgba(22,163,74,.16)",
          }}
        >
          <div className="coupon-batch-success-icon">
            <DashboardIcon name="checkmark" size={19} strokeWidth={2.4} />
          </div>
          <div style={{ flex: "1 1 auto", minWidth: 200 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
              {batch.coupons.length} coupon{batch.coupons.length === 1 ? "" : "s"} generated
            </div>
            <div style={{ marginTop: 2, fontSize: 12, color: "var(--color-graphite, #707070)" }}>
              SVG + PNG per coupon, plus a manifest.csv - ready for the print vendor.
            </div>
          </div>

          {exporting ? (
            <div style={{ width: 240, flexShrink: 0 }}>
              <div className="coupon-export-progress-track">
                <div
                  className="coupon-export-progress-fill"
                  style={{ width: `${exportProgressPercent(exportProgress)}%` }}
                />
              </div>
              <div className="coupon-export-progress-label">{exportProgressLabel(exportProgress)}</div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <GhostButton onClick={handleGenerateAnother}>Generate another</GhostButton>
              <PrimaryButton icon="download" onClick={handleExport}>
                Download ZIP
              </PrimaryButton>
            </div>
          )}
        </Surface>
      ) : null}

      <GenerateConfirmModal
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
    </div>
  );
}

function fieldInputStyle() {
  return {
    width: "100%",
    height: 40,
    borderRadius: 10,
    border: "none",
    background: "var(--color-fog,#f5f5f7)",
    padding: "0 12px",
    fontSize: 13.5,
    fontWeight: 500,
    color: "var(--color-ink,#1d1d1f)",
    outline: "none",
  };
}

function fieldLabelStyle() {
  return { fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" };
}

function getCatalogProductForm(product) {
  return {
    category: product?.category || "",
    name: product?.name || "",
    couponType: product?.couponType || "GREEN",
    pricingMode: product?.pricingMode || "SIZES",
    sizes: product?.sizes?.length ? product.sizes.map((entry) => ({ size: entry.size, points: String(entry.points) })) : [{ size: "", points: "" }],
    flatPoints: product?.flatPoints != null ? String(product.flatPoints) : "",
    rule: product?.rule || "",
    isActive: product?.isActive !== false,
  };
}

// Add/edit modal for one Painter Points Scheme catalog product - mirrors
// PainterFormModal.jsx's dynamic-array-rows pattern (there: phone numbers,
// here: size/points pairs), since a "Sizes" product can have any number of
// pack sizes.
function PointsCatalogProductFormModal({ open, product, saving, error, onClose, onSave }) {
  const [form, setForm] = useState(() => getCatalogProductForm(product));

  if (!open) return null;

  const cleanedSizes = form.sizes
    .map((entry) => ({ size: entry.size.trim(), points: Number(entry.points) }))
    .filter((entry) => entry.size && Number.isFinite(entry.points) && entry.points > 0);
  const flatPointsValue = Number(form.flatPoints);
  const canSave =
    form.category.trim() &&
    form.name.trim() &&
    !saving &&
    (form.pricingMode === "SIZES" ? cleanedSizes.length > 0 : Number.isFinite(flatPointsValue) && flatPointsValue > 0);

  function updateSize(index, key, value) {
    setForm((prev) => ({ ...prev, sizes: prev.sizes.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)) }));
  }
  function addSizeRow() {
    setForm((prev) => ({ ...prev, sizes: [...prev.sizes, { size: "", points: "" }] }));
  }
  function removeSizeRow(index) {
    setForm((prev) => ({ ...prev, sizes: prev.sizes.filter((_, i) => i !== index) }));
  }

  function handleSave() {
    const payload = {
      category: form.category.trim(),
      name: form.name.trim(),
      couponType: form.couponType,
      pricingMode: form.pricingMode,
      ...(form.pricingMode === "SIZES"
        ? { sizes: cleanedSizes }
        : { flatPoints: flatPointsValue, rule: form.rule.trim() }),
    };
    if (product?._id) payload.isActive = form.isActive;
    onSave(payload);
  }

  return (
    <div
      className="dash-modal-backdrop-in"
      style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "grid", placeItems: "center", padding: 28 }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: "min(560px, 100%)", maxHeight: "min(80vh, 720px)", overflowY: "auto" }} padding={22}>
        <SectionHeader
          title={product?._id ? "Edit Catalog Product" : "Add Catalog Product"}
          subtitle="Drives which coupon type + points a Generate batch resolves to."
          action={
            <GhostButton onClick={onClose} icon="reject">
              Close
            </GhostButton>
          }
        />

        <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={fieldLabelStyle()}>Category</span>
            <input
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              placeholder="e.g. Granite Textures"
              style={fieldInputStyle()}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={fieldLabelStyle()}>Product Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="e.g. Granite 2D"
              style={fieldInputStyle()}
            />
          </label>

          <div style={{ display: "flex", gap: 14 }}>
            <label style={{ display: "grid", gap: 6, flex: 1 }}>
              <span style={fieldLabelStyle()}>Coupon Type</span>
              <AppleDropdown value={form.couponType} options={TYPE_OPTIONS} onChange={(next) => setForm((prev) => ({ ...prev, couponType: next }))} style={{ width: "100%" }} />
            </label>
            <label style={{ display: "grid", gap: 6, flex: 1 }}>
              <span style={fieldLabelStyle()}>Pricing Mode</span>
              <AppleDropdown value={form.pricingMode} options={PRICING_MODE_OPTIONS} onChange={(next) => setForm((prev) => ({ ...prev, pricingMode: next }))} style={{ width: "100%" }} />
            </label>
          </div>

          {form.pricingMode === "SIZES" ? (
            <div style={{ display: "grid", gap: 8 }}>
              <span style={fieldLabelStyle()}>Sizes &amp; Points</span>
              {form.sizes.map((entry, index) => (
                <div key={index} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    value={entry.size}
                    onChange={(event) => updateSize(index, "size", event.target.value)}
                    placeholder="e.g. 20L"
                    style={{ ...fieldInputStyle(), flex: "1 1 40%" }}
                  />
                  <input
                    type="number"
                    min="1"
                    value={entry.points}
                    onChange={(event) => updateSize(index, "points", event.target.value)}
                    placeholder="Points"
                    style={{ ...fieldInputStyle(), flex: "1 1 40%" }}
                  />
                  <button
                    type="button"
                    onClick={() => removeSizeRow(index)}
                    disabled={form.sizes.length <= 1}
                    aria-label="Remove size"
                    style={{
                      width: 34,
                      height: 34,
                      flexShrink: 0,
                      border: "none",
                      borderRadius: 9,
                      background: "var(--color-fog,#f5f5f7)",
                      color: "var(--color-graphite,#707070)",
                      cursor: form.sizes.length <= 1 ? "not-allowed" : "pointer",
                      opacity: form.sizes.length <= 1 ? 0.5 : 1,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <DashboardIcon name="minus" size={13} strokeWidth={2} />
                  </button>
                </div>
              ))}
              <GhostButton icon="plus" onClick={addSizeRow} style={{ justifySelf: "start" }}>
                Add size
              </GhostButton>
            </div>
          ) : (
            <>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={fieldLabelStyle()}>Flat Points</span>
                <input
                  type="number"
                  min="1"
                  value={form.flatPoints}
                  onChange={(event) => setForm((prev) => ({ ...prev, flatPoints: event.target.value }))}
                  placeholder="e.g. 400"
                  style={fieldInputStyle()}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={fieldLabelStyle()}>Rule (shown to the admin at Generate time)</span>
                <textarea
                  rows={2}
                  value={form.rule}
                  onChange={(event) => setForm((prev) => ({ ...prev, rule: event.target.value }))}
                  placeholder="e.g. 200 points for Granite Primer and 200 points for Granite Intermediate Coating Paint."
                  style={{ ...fieldInputStyle(), height: "auto", padding: 12, resize: "vertical" }}
                />
              </label>
            </>
          )}

          {product?._id ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 2px" }}>
              <span style={fieldLabelStyle()}>Active</span>
              <ToggleSwitch checked={form.isActive} onChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))} label="Product active" />
            </div>
          ) : null}
        </div>

        {error ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        ) : null}

        <div style={{ marginTop: 22, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <PrimaryButton onClick={handleSave} disabled={!canSave}>
            {saving ? "Saving…" : "Save Product"}
          </PrimaryButton>
        </div>
      </Surface>
    </div>
  );
}

function catalogPricingSummary(product) {
  if (product.pricingMode === "FLAT") return `${product.flatPoints || 0} pts`;
  const sizes = product.sizes || [];
  if (!sizes.length) return "No sizes";
  const points = sizes
    .map((entry) => Number(entry.points))
    .filter((value) => Number.isFinite(value));
  const min = points.length ? Math.min(...points) : 0;
  const max = points.length ? Math.max(...points) : 0;
  return min === max ? `${sizes.length} size · ${min} pts` : `${sizes.length} sizes · ${min}-${max} pts`;
}

function CatalogProductCard({ product, onEdit, onDelete }) {
  const active = product.isActive !== false;
  const golden = product.couponType === "GOLDEN";

  return (
    <Surface padding={0} className="coupon-catalog-card">
      <div className="coupon-catalog-card-top">
        <span className={`coupon-catalog-card-icon${golden ? " is-golden" : ""}`}>
          <DashboardIcon name="package" size={18} strokeWidth={1.7} />
        </span>
        <div className="coupon-catalog-card-actions">
          <button type="button" className="coupon-catalog-icon-btn" onClick={() => onEdit(product)} aria-label={`Edit ${product.name}`}>
            <DashboardIcon name="edit" size={14} strokeWidth={1.9} />
          </button>
          <button type="button" className="coupon-catalog-icon-btn is-danger" onClick={() => onDelete(product)} aria-label={`Delete ${product.name}`}>
            <DashboardIcon name="trash" size={14} strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <div className="coupon-catalog-card-body">
        <div className="coupon-catalog-category">{product.category || "Catalog"}</div>
        <div className="coupon-catalog-name">{product.name}</div>
      </div>

      <div className="coupon-catalog-card-meta">
        <span className="coupon-catalog-meta-pill">
          <DashboardIcon name={golden ? "warning" : "shield"} size={12} strokeWidth={1.8} />
          {couponTypeLabel(product.couponType)}
        </span>
        <span className={`coupon-catalog-status${active ? " is-active" : ""}`}>{active ? "Active" : "Inactive"}</span>
      </div>

      <div className="coupon-catalog-card-foot">
        <span>
          <DashboardIcon name={product.pricingMode === "FLAT" ? "chart" : "stock"} size={13} strokeWidth={1.8} />
          {catalogPricingSummary(product)}
        </span>
      </div>
    </Surface>
  );
}

function CatalogTab({ onToast }) {
  const [category, setCategory] = useState("ALL");
  const [q, setQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [formProduct, setFormProduct] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionError, setActionError] = useState("");

  const catalogQuery = useGetAdminPointsCatalogProductsQuery({ q, category, limit: 500 });
  const [createProduct, { isLoading: creating }] = useCreatePointsCatalogProductMutation();
  const [updateProduct, { isLoading: updating }] = useUpdatePointsCatalogProductMutation();
  const [deleteProduct, { isLoading: deleting }] = useDeletePointsCatalogProductMutation();

  const items = useMemo(() => catalogQuery.data?.items || [], [catalogQuery.data]);
  const loadError = catalogQuery.error ? getQueryErrorMessage(catalogQuery.error, "Failed to load the product catalog.") : "";
  const error = actionError || loadError;

  const categoryOptions = useMemo(() => {
    const seen = new Set();
    const options = [CATALOG_CATEGORY_ALL_OPTION];
    for (const product of items) {
      if (!seen.has(product.category)) {
        seen.add(product.category);
        options.push({ key: product.category, label: product.category });
      }
    }
    return options;
  }, [items]);

  function submitSearch() {
    setQ(draftQ.trim());
  }

  function openAddForm() {
    setFormProduct(null);
    setActionError("");
    setFormOpen(true);
  }
  function openEditForm(product) {
    setFormProduct(product);
    setActionError("");
    setFormOpen(true);
  }

  async function handleSave(payload) {
    try {
      setActionError("");
      if (formProduct?._id) {
        await updateProduct({ productId: formProduct._id, payload }).unwrap();
        onToast({ tone: "success", title: "Product updated", description: `${payload.name} was saved.` });
      } else {
        await createProduct(payload).unwrap();
        onToast({ tone: "success", title: "Product added", description: `${payload.name} is now available in Generate.` });
      }
      setFormOpen(false);
      setFormProduct(null);
    } catch (err) {
      setActionError(getQueryErrorMessage(err, "Failed to save product."));
    }
  }

  async function handleDelete() {
    if (!deleteTarget?._id) return;
    try {
      await deleteProduct(deleteTarget._id).unwrap();
      onToast({ tone: "success", title: "Product deleted", description: `${deleteTarget.name} was removed from the catalog.` });
      setDeleteTarget(null);
    } catch (err) {
      setActionError(getQueryErrorMessage(err, "Failed to delete product."));
      setDeleteTarget(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={16}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <AppleDropdown value={category} options={categoryOptions} onChange={setCategory} style={{ width: 200 }} />
            <SearchField value={draftQ} onChange={setDraftQ} onSubmit={submitSearch} placeholder="Search product name…" style={{ maxWidth: 240 }} />
            {catalogQuery.isFetching ? (
              <Pill tone="accent" size="small">
                Updating…
              </Pill>
            ) : null}
          </div>
          <PrimaryButton icon="plus" onClick={openAddForm}>
            Add Product
          </PrimaryButton>
        </div>
      </Surface>

      {error ? (
        <div className="admin-coupons-error">{error}</div>
      ) : catalogQuery.isLoading && !catalogQuery.data ? (
        <Surface padding={18}>
          <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : items.length === 0 ? (
        <EmptyState icon="package" title="No catalog products found" subtitle="Add the first product to make it available in Generate." />
      ) : (
        <div className="coupon-catalog-grid">
          {items.map((product) => (
            <CatalogProductCard
              key={product._id}
              product={product}
              onEdit={openEditForm}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <PointsCatalogProductFormModal
        key={formProduct?._id || "new"}
        open={formOpen}
        product={formProduct}
        saving={creating || updating}
        error={actionError}
        onClose={() => {
          if (!creating && !updating) {
            setFormOpen(false);
            setFormProduct(null);
          }
        }}
        onSave={handleSave}
      />

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Delete catalog product?"
        description={`This will remove ${deleteTarget?.name || "this product"} from the catalog. Existing coupons already generated for it are unaffected.`}
        danger
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function HistoryTab() {
  const [type, setType] = useState("ALL");
  const [datePreset, setDatePreset] = useState("ALL");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [q, setQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [page, setPage] = useState(1);

  const historyParams = useMemo(() => {
    const params = { type, q, page, limit: PAGE_SIZE };
    const { from, to } = resolveCouponDateRange(datePreset, customFrom, customTo);
    if (from) params.from = from;
    if (to) params.to = to;
    return params;
  }, [customFrom, customTo, datePreset, page, q, type]);

  const historyQuery = useGetCouponRedemptionHistoryQuery(historyParams);
  const items = useMemo(() => historyQuery.data?.items || [], [historyQuery.data]);
  const groupedItems = useMemo(() => groupRedemptionsByDay(items), [items]);
  const pagination = historyQuery.data?.pagination || { page: 1, pages: 1, total: 0 };
  const loadError = historyQuery.error ? getQueryErrorMessage(historyQuery.error, "Failed to load redemption history.") : "";

  function changeType(next) {
    setType(next);
    setPage(1);
  }

  function changeDatePreset(next) {
    setDatePreset(next);
    setPage(1);
  }

  function changeCustomFrom(next) {
    setCustomFrom(next);
    setPage(1);
  }

  function changeCustomTo(next) {
    setCustomTo(next);
    setPage(1);
  }

  function submitSearch() {
    setQ(draftQ.trim());
    setPage(1);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={16}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <AppleDropdown value={type} options={HISTORY_TYPE_OPTIONS} onChange={changeType} style={{ width: 170 }} />
          <AppleDropdown icon="calendar" value={datePreset} options={COUPON_DATE_PRESETS} onChange={changeDatePreset} style={{ width: 170 }} />
          <SearchField value={draftQ} onChange={setDraftQ} onSubmit={submitSearch} placeholder="Search coupon code…" style={{ maxWidth: 260 }} />
          {datePreset === "CUSTOM" ? (
            <>
              <label className="coupon-history-date-field">
                From
                <AppleDateField value={customFrom} onChange={changeCustomFrom} />
              </label>
              <label className="coupon-history-date-field">
                To
                <AppleDateField value={customTo} onChange={changeCustomTo} />
              </label>
            </>
          ) : null}
          {historyQuery.isFetching ? (
            <Pill tone="accent" size="small">
              Updating…
            </Pill>
          ) : null}
        </div>
      </Surface>

      {loadError ? (
        <div className="admin-coupons-error">{loadError}</div>
      ) : historyQuery.isLoading && !historyQuery.data ? (
        <Surface padding={18}>
          <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : items.length === 0 ? (
        <EmptyState icon="invoice" title="No redemptions found" subtitle="Nothing matches these filters yet." />
      ) : (
        <>
          <div className="coupon-redemption-timeline">
            {groupedItems.map((group) => (
              <section key={group.key} className="coupon-redemption-day">
                <div className="coupon-redemption-day-header">
                  <span className="coupon-redemption-day-marker" aria-hidden="true" />
                  <div className="coupon-redemption-day-label">
                    {group.relativeLabel ? (
                      <>
                        <strong>{group.relativeLabel}</strong>
                        <span>•</span>
                        <span>{group.dateText}</span>
                      </>
                    ) : (
                      <strong>{group.dateText}</strong>
                    )}
                  </div>
                </div>
                <div className="coupon-redemption-list">
                  {group.items.map((row) => (
                    <CouponRedemptionRow key={row._id} row={row} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <Pagination page={pagination.page} totalPages={pagination.pages} totalCount={pagination.total} itemLabel="redemptions" onChange={setPage} />
        </>
      )}
    </div>
  );
}

// One card per generate-batch - product name/size, type, counts, date. The
// whole card opens the batch's coupon list; the trash icon is a separate
// click target (stopPropagation) so opening vs. deleting never collide.
// selectMode swaps the card's click target: normally a click navigates to
// the batch's own page (AdminCouponBatchDetailPage.jsx); in select mode the
// whole card becomes a toggle (a small passive checkmark badge shows state
// - it isn't a separate clickable control, "Select" in the toolbar above is).
function BatchCard({ batch, selected, selectMode, onOpen, onToggleSelect, onDeleteBatch }) {
  return (
    <Surface
      padding={16}
      className={`coupon-batch-card${selected ? " is-selected" : ""}`}
      onClick={selectMode ? onToggleSelect : onOpen}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {selectMode ? (
          <div className={`coupon-batch-select-badge${selected ? " is-checked" : ""}`} aria-hidden="true">
            {selected ? <DashboardIcon name="checkmark" size={12} strokeWidth={2.4} /> : null}
          </div>
        ) : null}

        <div className="coupon-batch-leading-icon" aria-hidden="true">
          <DashboardIcon name="invoice" size={17} strokeWidth={1.7} />
        </div>

        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
              {batch.productName}
              {batch.bucketSize ? ` · ${batch.bucketSize}` : ""}
            </span>
            <Pill tone={batch.type === "GOLDEN" ? "caution" : "positive"} size="small">
              {couponTypeLabel(batch.type)}
            </Pill>
          </div>
          <div style={{ marginTop: 3, fontSize: 12, color: "var(--color-graphite, #707070)" }}>
            {formatDateTime(batch.createdAt)} · {batch.totalCount} coupon{batch.totalCount === 1 ? "" : "s"} · {formatMoney(batch.totalCashAmount)}
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {batch.unusedCount > 0 ? (
              <Pill tone="positive" size="small">{batch.unusedCount} unused</Pill>
            ) : null}
            {batch.redeemedCount > 0 ? (
              <Pill tone="neutral" size="small">{batch.redeemedCount} redeemed</Pill>
            ) : null}
          </div>
        </div>

        {!selectMode ? (
          <button
            type="button"
            className="coupon-batch-icon-btn"
            title={batch.hasRedemptions ? "Contains redeemed coupons - cannot delete" : "Delete batch"}
            disabled={batch.hasRedemptions}
            onClick={(event) => {
              event.stopPropagation();
              onDeleteBatch();
            }}
          >
            <DashboardIcon name={batch.hasRedemptions ? "lock" : "trash"} size={15} strokeWidth={1.8} />
          </button>
        ) : null}
      </div>
    </Surface>
  );
}

function CouponsTab({ onToast }) {
  const navigate = useNavigate();
  const [type, setType] = useState("ALL");
  const [q, setQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [page, setPage] = useState(1);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState([]);
  const [deleteBatchTarget, setDeleteBatchTarget] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const batchesQuery = useGetAdminCouponBatchesQuery({ type, q, page, limit: PAGE_SIZE });
  const [deleteCouponBatch, deleteBatchState] = useDeleteCouponBatchMutation();
  const [deleteCouponBatches, bulkDeleteState] = useDeleteCouponBatchesMutation();

  const items = useMemo(() => batchesQuery.data?.items || [], [batchesQuery.data]);
  const pagination = batchesQuery.data?.pagination || { page: 1, pages: 1, total: 0 };
  const loadError = batchesQuery.error ? getQueryErrorMessage(batchesQuery.error, "Failed to load coupon batches.") : "";

  function changeType(next) {
    setType(next);
    setPage(1);
  }
  function submitSearch() {
    setQ(draftQ.trim());
    setPage(1);
  }
  function toggleSelect(batchId) {
    setSelectedBatchIds((prev) => (prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]));
  }
  function toggleSelectMode() {
    setSelectMode((prev) => {
      const next = !prev;
      if (!next) setSelectedBatchIds([]);
      return next;
    });
  }

  async function handleDeleteBatch() {
    try {
      await deleteCouponBatch(deleteBatchTarget.batchId).unwrap();
      onToast({ tone: "success", title: "Batch deleted", description: `${deleteBatchTarget.productName} (${deleteBatchTarget.totalCount} coupons) was permanently removed.` });
      setDeleteBatchTarget(null);
    } catch (err) {
      setDeleteBatchTarget(null);
      onToast({ tone: "error", title: "Could not delete batch", description: getQueryErrorMessage(err, "This batch may contain redeemed coupons.") });
    }
  }

  async function handleBulkDelete() {
    try {
      const result = await deleteCouponBatches(selectedBatchIds).unwrap();
      setSelectedBatchIds([]);
      setConfirmBulkDelete(false);
      const deletedCount = result.deletedBatchIds?.length || 0;
      const skippedCount = result.skippedBatchIds?.length || 0;
      onToast({
        tone: skippedCount ? "caution" : "success",
        title: `${deletedCount} batch${deletedCount === 1 ? "" : "es"} deleted`,
        description: skippedCount ? `${skippedCount} skipped - contains redeemed coupons.` : "Permanently removed from the database.",
      });
    } catch (err) {
      setConfirmBulkDelete(false);
      onToast({ tone: "error", title: "Could not delete batches", description: getQueryErrorMessage(err, "Failed to delete batches.") });
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={16}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <AppleDropdown value={type} options={HISTORY_TYPE_OPTIONS} onChange={changeType} style={{ width: 160 }} />
          <SearchField value={draftQ} onChange={setDraftQ} onSubmit={submitSearch} placeholder="Search product name…" style={{ maxWidth: 240 }} />
          <GhostButton icon={selectMode ? "close" : "checkSquare"} onClick={toggleSelectMode}>
            {selectMode ? "Cancel" : "Select"}
          </GhostButton>
          {batchesQuery.isFetching ? (
            <Pill tone="accent" size="small">
              Updating…
            </Pill>
          ) : null}
        </div>
      </Surface>

      <BulkActionBar count={selectedBatchIds.length} onClear={() => setSelectedBatchIds([])}>
        <button type="button" className="coupon-batch-bulk-delete-btn" title="Delete selected batches" onClick={() => setConfirmBulkDelete(true)}>
          <DashboardIcon name="trash" size={14} strokeWidth={2} />
        </button>
      </BulkActionBar>

      {loadError ? (
        <div className="admin-coupons-error">{loadError}</div>
      ) : batchesQuery.isLoading && !batchesQuery.data ? (
        <Surface padding={18}>
          <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : items.length === 0 ? (
        <EmptyState icon="invoice" title="No coupon batches found" subtitle="Generate a batch to see it appear here." />
      ) : (
        <>
          <div className="coupon-batch-grid">
            {items.map((batch) => (
              <BatchCard
                key={batch.batchId}
                batch={batch}
                selected={selectedBatchIds.includes(batch.batchId)}
                selectMode={selectMode}
                onToggleSelect={() => toggleSelect(batch.batchId)}
                onOpen={() => navigate(`/admin/dashboard/coupons/batches/${batch.batchId}`)}
                onDeleteBatch={() => setDeleteBatchTarget(batch)}
              />
            ))}
          </div>

          <Pagination page={pagination.page} totalPages={pagination.pages} totalCount={pagination.total} itemLabel="batches" onChange={setPage} />
        </>
      )}

      <ConfirmActionModal
        open={Boolean(deleteBatchTarget)}
        title="Delete entire batch?"
        description={`This permanently removes all ${deleteBatchTarget?.totalCount || 0} coupons in "${deleteBatchTarget?.productName || ""}" from the database. This cannot be undone.`}
        confirmText="Delete"
        danger
        loading={deleteBatchState.isLoading}
        onClose={() => setDeleteBatchTarget(null)}
        onConfirm={handleDeleteBatch}
      />

      <ConfirmActionModal
        open={confirmBulkDelete}
        title={`Delete ${selectedBatchIds.length} batch${selectedBatchIds.length === 1 ? "" : "es"}?`}
        description="Batches containing any redeemed coupon are skipped automatically. This cannot be undone for the rest."
        confirmText="Delete"
        danger
        loading={bulkDeleteState.isLoading}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}

function AttemptsTab() {
  const [outcome, setOutcome] = useState("ALL");
  const [page, setPage] = useState(1);

  const attemptsQuery = useGetCouponAttemptsQuery({ outcome, page, limit: PAGE_SIZE });
  const items = useMemo(() => attemptsQuery.data?.items || [], [attemptsQuery.data]);
  const pagination = attemptsQuery.data?.pagination || { page: 1, pages: 1, total: 0 };
  const loadError = attemptsQuery.error ? getQueryErrorMessage(attemptsQuery.error, "Failed to load attempt log.") : "";

  function changeOutcome(next) {
    setOutcome(next);
    setPage(1);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={16}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <AppleDropdown value={outcome} options={OUTCOME_OPTIONS} onChange={changeOutcome} style={{ width: 200 }} />
          {attemptsQuery.isFetching ? (
            <Pill tone="accent" size="small">
              Updating…
            </Pill>
          ) : null}
        </div>
      </Surface>

      {loadError ? (
        <div className="admin-coupons-error">{loadError}</div>
      ) : attemptsQuery.isLoading && !attemptsQuery.data ? (
        <Surface padding={18}>
          <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : items.length === 0 ? (
        <EmptyState icon="shield" title="No attempts found" subtitle="Nothing matches these filters yet." />
      ) : (
        <>
          <Surface padding={0}>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-coupons-table" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Outcome</th>
                    <th>Coupon</th>
                    <th>Dealer</th>
                    <th>User</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row._id}>
                      <td style={{ whiteSpace: "nowrap", color: "var(--color-graphite, #707070)" }}>{formatDateTime(row.createdAt)}</td>
                      <td>
                        <Pill tone={outcomeTone(row.outcome)} size="small">
                          {row.outcome.replaceAll("_", " ")}
                        </Pill>
                      </td>
                      <td className="admin-coupons-mono">{row.couponId?.couponCode || "—"}</td>
                      <td>{row.dealerId?.companyName || "—"}</td>
                      <td style={{ color: "var(--color-graphite, #707070)" }}>{row.userId?.username || row.userId?.email || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>

          <Pagination page={pagination.page} totalPages={pagination.pages} totalCount={pagination.total} itemLabel="attempts" onChange={setPage} />
        </>
      )}
    </div>
  );
}

function SettlementTab() {
  const settlementQuery = useGetSettlementReportQuery({});
  const items = useMemo(() => settlementQuery.data?.items || [], [settlementQuery.data]);
  const loadError = settlementQuery.error ? getQueryErrorMessage(settlementQuery.error, "Failed to load settlement report.") : "";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {loadError ? (
        <div className="admin-coupons-error">{loadError}</div>
      ) : settlementQuery.isLoading && !settlementQuery.data ? (
        <Surface padding={18}>
          <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : items.length === 0 ? (
        <EmptyState icon="invoice" title="No cash payouts yet" subtitle="Dealer cash payout totals will show up here once coupons are redeemed." />
      ) : (
        <Surface padding={0}>
          <div style={{ overflowX: "auto" }}>
            <table className="admin-coupons-table" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Dealer</th>
                  <th className="align-right">Redemptions</th>
                  <th className="align-right">Points Paid Out</th>
                  <th className="align-right">Cash Paid Out</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.dealerId}>
                    <td style={{ fontWeight: 700 }}>{row.dealer?.companyName || "Unknown dealer"}</td>
                    <td className="align-right admin-coupons-tabular">{row.redemptionCount}</td>
                    <td className="align-right admin-coupons-tabular">{row.totalPoints.toLocaleString()}</td>
                    <td className="align-right admin-coupons-tabular" style={{ fontWeight: 700, color: "var(--color-azure, #0071e3)" }}>{formatMoney(row.totalCashPaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      )}
    </div>
  );
}

export default function AdminCouponsPage() {
  const [tab, setTab] = useState("generate");
  const [toast, setToast] = useState(null);

  return (
    <div className="admin-coupons-page">
      <DashboardUIStyles />
      <TabBar options={COUPON_TABS} value={tab} onChange={setTab} />

      <div className="admin-coupons-content">
        {tab === "generate" ? (
          <GenerateTab onToast={setToast} />
        ) : tab === "catalog" ? (
          <CatalogTab onToast={setToast} />
        ) : tab === "coupons" ? (
          <CouponsTab onToast={setToast} />
        ) : tab === "history" ? (
          <HistoryTab />
        ) : tab === "attempts" ? (
          <AttemptsTab />
        ) : (
          <SettlementTab />
        )}
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <style>{`
        .admin-coupons-page{
          display:grid;
          gap:16px;
          color:var(--color-ink, #1d1d1f);
          font-family:var(--font-sf-pro-text, Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif);
        }

        .coupon-settings-btn:focus-visible,
        .coupon-catalog-icon-btn:focus-visible,
        .coupon-batch-icon-btn:focus-visible,
        .coupon-batch-bulk-delete-btn:focus-visible{
          outline:none;
          box-shadow:0 0 0 3px rgba(0,113,227,.18);
        }

        .admin-coupons-content{
          display:grid;
          gap:16px;
        }

        .admin-coupons-field-label{
          font-size:11px;
          font-weight:700;
          letter-spacing:.02em;
          color:var(--color-graphite, #707070);
          margin-bottom:6px;
        }
        .admin-coupons-field{
          width:100%;
          height:42px;
          border-radius:12px;
          border:1px solid rgba(0,0,0,.1);
          padding:0 14px;
          font-size:13.5px;
          font-family:inherit;
          background:#fff;
          color:var(--color-ink, #1d1d1f);
          transition:border-color .14s ease, box-shadow .14s ease;
        }
        .admin-coupons-field:focus-visible{
          outline:none;
          border-color:rgba(0,113,227,.4);
          box-shadow:0 0 0 3px rgba(0,113,227,.12);
        }
        .coupon-generate-layout{
          display:grid;
          gap:14px;
        }
        .coupon-generate-form{
          display:grid;
          gap:12px;
        }
        .coupon-generate-panel{
          display:grid;
          grid-template-columns:minmax(0, 1.45fr) minmax(230px, .62fr);
          gap:12px;
          align-items:stretch;
        }
        .coupon-settings-anchor{
          position:relative;
        }
        .coupon-settings-btn{
          position:relative;
          z-index:41;
          width:30px;
          height:30px;
          border:1px solid rgba(29,29,31,.1);
          border-radius:9px;
          background:#fff;
          color:var(--color-graphite, #707070);
          display:grid;
          place-items:center;
          cursor:pointer;
          transition:background .14s ease, color .14s ease, border-color .14s ease, transform .14s var(--ease-out, ease);
        }
        .coupon-settings-btn:hover{
          background:var(--color-fog, #f5f5f7);
          color:var(--color-ink, #1d1d1f);
        }
        .coupon-settings-btn:active{
          transform:scale(.92);
        }
        .coupon-settings-btn.is-active{
          background:rgba(0,113,227,.1);
          color:var(--color-azure, #0071e3);
          border-color:rgba(0,113,227,.24);
        }
        .coupon-settings-popover{
          position:absolute;
          top:calc(100% + 8px);
          right:0;
          z-index:50;
          width:260px;
          padding:16px;
          border-radius:16px;
          background:#fff;
          border:1px solid rgba(0,0,0,.07);
          box-shadow:0 18px 44px rgba(0,0,0,.16);
          transform-origin:top right;
        }
        .coupon-settings-popover-header{
          display:flex;
          align-items:center;
          gap:7px;
          font-size:12.5px;
          font-weight:700;
          color:var(--color-ink, #1d1d1f);
        }
        .coupon-settings-popover-helper{
          margin-top:5px;
          margin-bottom:12px;
          font-size:11.5px;
          line-height:1.45;
          color:var(--color-graphite, #707070);
        }
        .coupon-weight-input-row{
          display:flex;
          align-items:center;
          gap:8px;
          height:46px;
          border-radius:12px;
          background:var(--color-fog, #f5f5f7);
          padding:0 14px;
        }
        .coupon-weight-prefix{
          font-size:16px;
          font-weight:800;
          color:var(--color-graphite, #707070);
        }
        .coupon-weight-input{
          flex:1 1 auto;
          min-width:0;
          border:none;
          background:transparent;
          font-size:20px;
          font-weight:800;
          font-variant-numeric:tabular-nums;
          font-family:inherit;
          color:var(--color-ink, #1d1d1f);
          outline:none;
        }
        .coupon-batch-success-icon{
          width:42px;
          height:42px;
          flex-shrink:0;
          border-radius:13px;
          display:grid;
          place-items:center;
          background:rgba(22,163,74,.15);
          color:#15803d;
        }
        .coupon-export-progress-track{
          width:100%;
          height:8px;
          border-radius:999px;
          background:rgba(0,113,227,.14);
          overflow:hidden;
        }
        .coupon-export-progress-fill{
          height:100%;
          border-radius:999px;
          background:linear-gradient(90deg, #0071e3, #34aadc);
          transition:width .2s ease;
        }
        .coupon-export-progress-label{
          margin-top:6px;
          font-size:11.5px;
          font-weight:600;
          color:var(--color-graphite, #707070);
          text-align:right;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        .coupon-product-card{
          padding:6px !important;
          border-radius:20px!important;
          background:var(--color-fog, #f5f5f7)!important;
          border-color:transparent!important;
        }
        .coupon-product-row{
          padding:10px;
          border-radius:16px;
          background:transparent;
          transition:background .14s ease;
        }
        .coupon-product-row + .coupon-product-row{
          border-top:0;
          margin-top:2px;
        }
        .coupon-product-row:hover{
          background:rgba(255,255,255,.68);
        }
        .coupon-product-row-head{
          display:flex;
          align-items:center;
          gap:7px;
          margin-bottom:7px;
        }
        .coupon-product-icon{
          width:26px;
          height:26px;
          flex-shrink:0;
          border-radius:9px;
          display:grid;
          place-items:center;
          background:#fff;
          color:var(--color-ink, #1d1d1f);
        }
        .coupon-product-eyebrow{
          font-size:11px;
          font-weight:700;
          letter-spacing:.04em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
        }
        .coupon-product-row-control{
          display:flex;
        }
        .coupon-product-row.is-primary .coupon-product-icon{
          width:30px;
          height:30px;
          border-radius:10px;
          background:var(--color-ink, #1d1d1f);
          color:#fff;
        }
        .coupon-product-row.is-primary .coupon-product-eyebrow{
          font-size:11.5px;
          color:var(--color-ink, #1d1d1f);
        }
        .coupon-product-row.is-primary .apple-dropdown-menu-trigger{
          height:44px;
          font-size:14.5px;
          font-weight:800;
          background:#fff;
        }
        .coupon-product-row.is-primary .apple-dropdown-menu-trigger:hover{
          background:#fff;
        }
        .coupon-field-grid{
          display:grid;
          grid-template-columns:1fr;
          gap:10px;
        }
        .coupon-field-card{
          display:grid;
          gap:8px;
          align-content:start;
          padding:14px;
          border-radius:20px;
          background:var(--color-snow, #fff);
          border:1px solid var(--color-silver-mist, #e8e8ed);
        }
        .coupon-field-label{
          display:flex;
          align-items:center;
          gap:6px;
          font-size:11px;
          font-weight:700;
          letter-spacing:.04em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
        }
        .coupon-field-control{
          display:flex;
        }
        .coupon-field-helper{
          font-size:11.5px;
          line-height:1.45;
          color:var(--color-graphite, #707070);
        }
        .coupon-field-placeholder{
          display:flex;
          align-items:center;
          height:44px;
          font-size:13px;
          color:var(--color-graphite, #707070);
        }
        .coupon-field-skeleton{
          width:100%;
          height:44px;
          border-radius:999px;
          background:linear-gradient(90deg, rgba(0,0,0,.045), rgba(0,0,0,.02), rgba(0,0,0,.045));
        }
        .coupon-field-waiting{
          display:flex;
          align-items:center;
          gap:8px;
          width:100%;
          height:44px;
          padding:0 14px;
          border-radius:999px;
          border:1px dashed rgba(29,29,31,.14);
          background:rgba(232,232,237,.32);
          color:var(--color-graphite, #86868b);
          font-size:12.5px;
          font-weight:600;
        }
        .coupon-preview-card{
          display:flex;
          flex-direction:column;
          gap:10px;
          padding:14px;
          border-radius:20px;
          background:var(--color-snow, #fff);
          border:1px dashed var(--color-silver-mist, #e8e8ed);
        }
        .coupon-preview-card.is-filled{
          border-style:solid;
          border-color:rgba(0,113,227,.16);
          background:linear-gradient(160deg, rgba(0,113,227,.05), rgba(255,255,255,.9));
        }
        .coupon-preview-head{
          display:flex;
          align-items:center;
          gap:10px;
        }
        .coupon-preview-icon{
          width:32px;
          height:32px;
          flex-shrink:0;
          border-radius:11px;
          display:grid;
          place-items:center;
          background:var(--color-ink, #1d1d1f);
          color:#fff;
        }
        .coupon-preview-icon.is-muted{
          background:var(--color-fog, #f5f5f7);
          color:var(--color-graphite, #86868b);
        }
        .coupon-preview-title{
          min-width:0;
        }
        .coupon-preview-name{
          font-size:14px;
          font-weight:750;
          color:var(--color-ink, #1d1d1f);
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .coupon-preview-meta{
          margin-top:1px;
          font-size:11.5px;
          font-weight:600;
          color:var(--color-graphite, #86868b);
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .coupon-preview-stats{
          display:flex;
          align-items:center;
          gap:8px;
          flex-wrap:wrap;
        }
        .coupon-preview-points{
          font-size:12.5px;
          font-weight:700;
          color:var(--color-ink, #1d1d1f);
        }
        .coupon-preview-empty{
          display:flex;
          align-items:center;
          gap:10px;
        }
        .coupon-preview-empty-title{
          font-size:12.5px;
          font-weight:700;
          color:var(--color-graphite, #707070);
        }
        .coupon-preview-empty-helper{
          margin-top:1px;
          font-size:11.5px;
          line-height:1.4;
          color:var(--color-graphite, #86868b);
        }
        .coupon-field-input{
          width:100%;
          height:42px;
          border-radius:999px;
          border:none;
          background:rgba(232,232,237,.72);
          padding:0 16px;
          font-size:13px;
          font-weight:650;
          font-family:inherit;
          color:var(--color-ink, #1d1d1f);
          transition:background .16s ease, box-shadow .14s ease;
        }
        .coupon-field-input:hover{
          background:rgba(232,232,237,.95);
        }
        .coupon-field-input:focus-visible{
          outline:none;
          box-shadow:0 0 0 3px rgba(0,113,227,.18);
        }
        .coupon-field-card .apple-date-field-trigger{
          width:100%;
          height:42px;
          border-radius:999px;
          background:rgba(232,232,237,.72);
        }
        .coupon-field-card .apple-date-field-trigger:hover{
          background:rgba(232,232,237,.95);
        }
        .admin-coupons-cta-bar{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          padding:14px 16px;
          border-radius:22px;
          background:
            linear-gradient(135deg, rgba(29,29,31,.96), rgba(29,29,31,.9)),
            var(--color-ink, #1d1d1f);
          border:1px solid rgba(255,255,255,.08);
        }
        .admin-coupons-cta-label{
          font-size:11px;
          font-weight:700;
          letter-spacing:.04em;
          text-transform:uppercase;
          color:rgba(255,255,255,.58);
        }
        .admin-coupons-cta-value{
          margin-top:2px;
          font-size:24px;
          font-weight:800;
          color:#fff;
          letter-spacing:-.045em;
        }
        .admin-coupons-cta-bar .dash-primary-btn{
          background:var(--color-azure, #0071e3)!important;
          color:#fff!important;
          min-height:40px;
          padding-inline:16px;
        }
        @media (max-width:520px){
          .admin-coupons-cta-bar{
            flex-direction:column;
            align-items:flex-start;
          }
        }
        .admin-coupons-error{
          padding:12px 14px;
          border-radius:12px;
          background:rgba(180,35,24,.08);
          color:#b42318;
          font-size:13px;
          font-weight:600;
        }
        .coupon-catalog-grid{
          display:grid;
          grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));
          gap:10px;
        }
        .coupon-catalog-card{
          min-height:174px;
          display:flex;
          flex-direction:column;
          overflow:hidden;
          background:var(--color-snow, #fff)!important;
          transition:background .16s ease, transform .16s var(--ease-out, ease), border-color .16s ease;
        }
        .coupon-catalog-card:hover{
          transform:translateY(-1px);
          background:linear-gradient(180deg, rgba(255,255,255,.98), rgba(245,245,247,.78))!important;
          border-color:rgba(0,113,227,.18)!important;
        }
        .coupon-catalog-card-top{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:10px;
          padding:13px 13px 0;
        }
        .coupon-catalog-card-icon{
          width:36px;
          height:36px;
          border-radius:13px;
          display:grid;
          place-items:center;
          background:var(--color-fog, #f5f5f7);
          color:var(--color-ink, #1d1d1f);
        }
        .coupon-catalog-card-icon.is-golden{
          background:rgba(182,68,0,.1);
          color:var(--color-caution, #b64400);
        }
        .coupon-catalog-card-actions{
          display:flex;
          align-items:center;
          gap:6px;
        }
        .coupon-catalog-icon-btn{
          width:30px;
          height:30px;
          border:none;
          border-radius:10px;
          display:grid;
          place-items:center;
          background:var(--color-fog, #f5f5f7);
          color:var(--color-graphite, #707070);
          cursor:pointer;
          transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease);
        }
        .coupon-catalog-icon-btn:hover{
          background:rgba(0,113,227,.1);
          color:var(--color-azure, #0071e3);
        }
        .coupon-catalog-icon-btn.is-danger:hover{
          background:rgba(180,35,24,.1);
          color:#b42318;
        }
        .coupon-catalog-icon-btn:active{
          transform:scale(.92);
        }
        .coupon-catalog-card-body{
          flex:1 1 auto;
          padding:12px 13px;
          min-width:0;
        }
        .coupon-catalog-category{
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
          font-size:11px;
          font-weight:700;
          letter-spacing:.05em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
        }
        .coupon-catalog-name{
          margin-top:5px;
          color:var(--color-ink, #1d1d1f);
          font-size:17px;
          line-height:1.12;
          font-weight:800;
          letter-spacing:-.045em;
          display:-webkit-box;
          -webkit-line-clamp:2;
          -webkit-box-orient:vertical;
          overflow:hidden;
        }
        .coupon-catalog-card-meta{
          display:flex;
          align-items:center;
          gap:6px;
          flex-wrap:wrap;
          padding:0 13px 11px;
        }
        .coupon-catalog-meta-pill,
        .coupon-catalog-status{
          min-height:24px;
          display:inline-flex;
          align-items:center;
          gap:5px;
          padding:0 9px;
          border-radius:999px;
          background:var(--color-fog, #f5f5f7);
          color:var(--color-graphite, #707070);
          font-size:11px;
          font-weight:700;
        }
        .coupon-catalog-status.is-active{
          background:rgba(22,163,74,.1);
          color:#15803d;
        }
        .coupon-catalog-card-foot{
          border-top:1px solid rgba(29,29,31,.07);
          padding:10px 13px;
          color:var(--color-graphite, #707070);
          font-size:12px;
          font-weight:650;
        }
        .coupon-catalog-card-foot span{
          display:inline-flex;
          align-items:center;
          gap:7px;
        }
        .coupon-history-date-field{
          display:flex;
          align-items:center;
          gap:8px;
          color:var(--color-graphite, #707070);
          font-size:12px;
          font-weight:650;
        }
        .coupon-redemption-timeline{
          display:grid;
          gap:18px;
        }
        .coupon-redemption-day{
          position:relative;
          display:grid;
          gap:10px;
        }
        .coupon-redemption-day-header{
          display:flex;
          align-items:center;
          gap:10px;
          padding:0 4px;
        }
        .coupon-redemption-day-marker{
          width:8px;
          height:8px;
          border-radius:999px;
          background:var(--color-azure, #0071e3);
          box-shadow:0 0 0 4px rgba(0,113,227,.1);
        }
        .coupon-redemption-day-label{
          display:flex;
          align-items:center;
          gap:8px;
          color:var(--color-graphite, #707070);
          font-size:13px;
          font-weight:650;
        }
        .coupon-redemption-day-label strong{
          color:var(--color-ink, #1d1d1f);
          font-weight:800;
        }
        .coupon-redemption-list{
          display:grid;
          gap:10px;
        }
        .coupon-redemption-row{
          display:grid;
          grid-template-columns:42px minmax(140px, 160px) minmax(170px, 1.05fr) minmax(150px, .95fr) 92px minmax(250px, auto);
          align-items:center;
          gap:14px;
          min-height:84px;
          padding:14px;
          border-radius:22px;
          border:1px solid rgba(29,29,31,.075);
          background:var(--color-snow, #fff);
          transition:background .16s ease, border-color .16s ease, transform .16s var(--ease-out, ease);
        }
        .coupon-redemption-row:hover{
          transform:translateY(-1px);
          border-color:rgba(0,113,227,.18);
          background:linear-gradient(180deg, rgba(255,255,255,.98), rgba(245,245,247,.72));
        }
        .coupon-redemption-icon{
          width:42px;
          height:42px;
          border-radius:15px;
          display:grid;
          place-items:center;
          background:rgba(22,163,74,.1);
          color:#15803d;
        }
        .coupon-redemption-icon.is-golden{
          background:linear-gradient(145deg, rgba(250,204,21,.22), rgba(245,158,11,.12));
          color:#a16207;
        }
        .coupon-redemption-main{
          min-width:0;
          display:grid;
          gap:7px;
        }
        .coupon-redemption-title-row{
          display:flex;
          align-items:center;
          gap:8px;
          min-width:0;
          flex-wrap:wrap;
        }
        .coupon-redemption-code{
          font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          color:var(--color-ink, #1d1d1f);
          font-size:14.5px;
          font-weight:800;
          letter-spacing:-.015em;
        }
        .coupon-redemption-detail{
          min-width:0;
          display:grid;
          gap:5px;
          align-content:center;
        }
        .coupon-redemption-detail-label{
          color:var(--color-graphite, #707070);
          font-size:10px;
          font-weight:800;
          letter-spacing:.05em;
          text-transform:uppercase;
        }
        .coupon-redemption-detail-value{
          display:inline-flex;
          align-items:center;
          gap:5px;
          min-width:0;
          color:var(--color-ink, #1d1d1f);
          font-size:12.5px;
          font-weight:650;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .coupon-redemption-metrics{
          display:flex;
          align-items:center;
          justify-content:flex-end;
          gap:12px;
          white-space:nowrap;
        }
        .coupon-redemption-type{
          min-height:24px;
          display:inline-flex;
          align-items:center;
          border-radius:999px;
          padding:0 9px;
          background:rgba(22,163,74,.1);
          color:#15803d;
          font-size:11px;
          font-weight:800;
        }
        .coupon-redemption-type.is-golden{
          background:rgba(250,204,21,.18);
          color:#854d0e;
        }
        .coupon-redemption-points{
          min-width:72px;
          text-align:right;
        }
        .coupon-redemption-points span{
          display:block;
          color:var(--color-ink, #1d1d1f);
          font-size:17px;
          line-height:1;
          font-weight:800;
          font-variant-numeric:tabular-nums;
          letter-spacing:-.035em;
        }
        .coupon-redemption-points small{
          display:block;
          margin-top:3px;
          color:var(--color-graphite, #707070);
          font-size:10.5px;
          font-weight:700;
          text-transform:uppercase;
          letter-spacing:.04em;
        }
        .coupon-redemption-cash{
          min-width:112px;
          text-align:right;
          color:var(--color-ink, #1d1d1f);
          font-size:14px;
          font-weight:800;
          font-variant-numeric:tabular-nums;
          letter-spacing:-.02em;
        }
        .admin-coupons-mono{
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-weight:700;
          letter-spacing:-.01em;
        }
        .admin-coupons-tabular{
          font-variant-numeric: tabular-nums;
        }
        .admin-coupons-table{
          width:100%;
          border-collapse:collapse;
        }
        .admin-coupons-table thead tr{
          background:var(--color-fog, #f5f5f7);
        }
        .admin-coupons-table th{
          text-align:left;
          padding:10px 14px;
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.05em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
          white-space:nowrap;
        }
        .admin-coupons-table th.align-right,
        .admin-coupons-table td.align-right{
          text-align:right;
        }
        .admin-coupons-table td{
          padding:11px 14px;
          font-size:13px;
          border-top:1px solid rgba(0,0,0,.05);
          color:var(--color-ink, #1d1d1f);
        }
        .admin-coupons-table tbody tr{
          transition:background .12s ease;
        }
        .admin-coupons-table tbody tr:hover{
          background:rgba(0,113,227,.035);
        }
        .coupon-batch-card{
          cursor:pointer;
          padding:12px!important;
          transition:transform .16s var(--ease-out, ease), background .16s ease, border-color .16s ease;
        }
        .coupon-batch-card:hover{
          transform:translateY(-1px);
          background:linear-gradient(180deg, rgba(255,255,255,.98), rgba(245,245,247,.72));
        }
        .coupon-batch-card:active{
          transform:scale(.995);
        }
        .coupon-batch-card.is-selected{
          border-color:rgba(0,113,227,.4);
          background:linear-gradient(180deg, rgba(0,113,227,.07), rgba(255,255,255,.94));
        }
        .coupon-batch-leading-icon{
          width:34px;
          height:34px;
          flex-shrink:0;
          border-radius:12px;
          display:grid;
          place-items:center;
          background:var(--color-fog, #f5f5f7);
          color:var(--color-ink, #1d1d1f);
        }
        .coupon-batch-select-badge{
          width:20px;
          height:20px;
          margin-top:2px;
          flex-shrink:0;
          border-radius:999px;
          border:1.5px solid rgba(0,0,0,.18);
          background:#fff;
          display:grid;
          place-items:center;
          color:#fff;
          transition:background .14s ease, border-color .14s ease;
        }
        .coupon-batch-select-badge.is-checked{
          background:var(--color-azure, #0071e3);
          border-color:var(--color-azure, #0071e3);
        }
        .coupon-batch-icon-btn{
          width:32px;
          height:32px;
          flex-shrink:0;
          border:none;
          border-radius:9px;
          display:grid;
          place-items:center;
          background:var(--color-fog, #f5f5f7);
          color:var(--color-graphite, #707070);
          cursor:pointer;
          transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease), opacity .14s ease;
        }
        .coupon-batch-icon-btn:hover:not(:disabled){
          background:rgba(180,35,24,.1);
          color:#b42318;
        }
        .coupon-batch-icon-btn:active:not(:disabled){
          transform:scale(.92);
        }
        .coupon-batch-icon-btn:disabled{
          opacity:.4;
          cursor:not-allowed;
        }
        .coupon-batch-bulk-delete-btn{
          width:32px;
          height:32px;
          flex-shrink:0;
          border:none;
          border-radius:9px;
          display:grid;
          place-items:center;
          background:rgba(180,35,24,.12);
          color:#b42318;
          cursor:pointer;
          transition:background .14s ease, transform .14s var(--ease-out, ease);
        }
        .coupon-batch-bulk-delete-btn:hover{
          background:rgba(180,35,24,.18);
        }
        .coupon-batch-bulk-delete-btn:active{
          transform:scale(.92);
        }
        @media (prefers-reduced-motion: reduce){
          .admin-coupons-nav-btn,
          .coupon-catalog-card,
          .coupon-catalog-icon-btn,
          .coupon-batch-card,
          .coupon-batch-icon-btn,
          .coupon-batch-bulk-delete-btn{
            transition:none!important;
          }
        }

        @media (max-width:820px){
          .admin-coupons-hero{
            grid-template-columns:1fr;
            align-items:stretch;
          }

          .coupon-generate-panel{
            grid-template-columns:1fr;
          }
        }

        @media (max-width:640px){
          .admin-coupons-hero{
            padding:10px;
            border-radius:20px;
          }

          .admin-coupons-nav{
            width:100%;
            justify-content:flex-start;
          }

          .admin-coupons-nav-btn{
            min-height:34px;
            padding:4px 10px 4px 6px;
          }

          .admin-coupons-hero h1{
            font-size:20px;
          }

          .coupon-redemption-row{
            grid-template-columns:auto minmax(0, 1fr);
            align-items:start;
          }

          .coupon-redemption-detail{
            grid-column:1 / -1;
            grid-template-columns:72px minmax(0, 1fr);
            align-items:center;
          }

          .coupon-redemption-metrics{
            grid-column:1 / -1;
            justify-content:space-between;
            padding-top:10px;
            border-top:1px solid rgba(29,29,31,.07);
          }

          .coupon-redemption-points{
            text-align:left;
          }
        }
      `}</style>
    </div>
  );
}
