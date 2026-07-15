import { useEffect, useMemo, useState } from "react";
import {
  useCreateAdminProductMutation,
  useDeleteAdminProductMutation,
  useRestoreAdminProductMutation,
  useUpdateAdminProductMutation,
} from "../../../redux/api/meituApi.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  Dropdown,
  GhostButton,
  Pill,
  PrimaryButton,
  SectionHeader,
  SegmentedControl,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";

/* -----------------------------
   constants
----------------------------- */
const PRICING_MODEL_OPTIONS = [
  { value: "VOL_L_1_80_81_250_251_PLUS", label: "Volume tiers" },
  { value: "TOTALVOL_L_1_20_21_PLUS", label: "Total volume tiers" },
  { value: "BKT_1_5_6_10_11_PLUS", label: "Bucket count tiers" },
  { value: "UNIT_1_20_21_PLUS", label: "Unit count tiers" },
  { value: "FLAT", label: "Flat" },
];

const BASIS_OPTIONS = [
  { value: "VOLUME_TOTAL", label: "Volume Total" },
  { value: "PACK_COUNT", label: "Pack Count" },
  { value: "UNIT_COUNT", label: "Unit Count" },
  { value: "FLAT", label: "Flat" },
];

const SELECT_CATEGORY_OPTION = { value: "", label: "Select category" };

const PACK_UNIT_OPTIONS = [
  { value: "L", label: "Litre (L)" },
  { value: "KG", label: "Kilogram (KG)" },
  { value: "ML", label: "Millilitre (ML)" },
  { value: "GM", label: "Gram (GM)" },
  { value: "PC", label: "Piece (PC)" },
  { value: "PCS", label: "Pieces (PCS)" },
  { value: "SET", label: "Set" },
  { value: "ROLL", label: "Roll" },
  { value: "PAIR", label: "Pair" },
  { value: "M", label: "Meter (M)" },
];

const STATUS_OPTIONS = [
  { key: "ACTIVE", label: "Active" },
  { key: "INACTIVE", label: "Inactive" },
];

function toDropdownOptions(options) {
  return options.map((option) => ({ key: option.value, label: option.label }));
}

function categoryLabel(value) {
  if (!value) return "Uncategorized";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// Matches the SCREAMING_SNAKE_CASE convention every existing category value
// already uses (categoryLabel() turns "WOOD_STAINS" back into "Wood Stains"),
// so a freshly typed category displays identically to the seeded ones.
function normalizeNewCategoryValue(input) {
  return String(input || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

function normalizeCategoryOption(option) {
  const value = typeof option === "string" ? option : option?.value || option?.code || option?.category || "";
  const cleanValue = String(value || "").trim();

  if (!cleanValue || cleanValue === "ALL") return null;

  return {
    value: cleanValue,
    label: typeof option === "object" && option?.label ? String(option.label) : categoryLabel(cleanValue),
  };
}

function buildEditorCategoryOptions(categoryOptions = [], currentCategory = "") {
  const map = new Map();

  for (const option of categoryOptions) {
    const normalized = normalizeCategoryOption(option);
    if (normalized) map.set(normalized.value, normalized);
  }

  const current = normalizeCategoryOption(currentCategory);
  if (current && !map.has(current.value)) {
    map.set(current.value, current);
  }

  return [SELECT_CATEGORY_OPTION, ...Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))];
}

function createDefaultTiers() {
  return [
    { min: 1, max: 80, pricePerPack: "" },
    { min: 81, max: 250, pricePerPack: "" },
    { min: 251, max: null, pricePerPack: "" },
  ];
}

function createInitialForm() {
  return {
    code: "",
    sku: "",
    name: "",
    category: "",
    description: "",
    size: "",
    unit: "L",
    currency: "NPR",
    pricingModelKey: "VOL_L_1_80_81_250_251_PLUS",
    basis: "VOLUME_TOTAL",
    tierUnit: "L",
    tiers: createDefaultTiers(),
    isActive: true,
  };
}

function normalizeTierInputValue(value) {
  if (value === "" || value === null || value === undefined) return "";
  return String(value);
}

function parseRequiredNumber(value) {
  const num = Number(value);
  return Number.isNaN(num) ? NaN : num;
}

function getBasisHint(basis, tierUnit) {
  if (basis === "VOLUME_TOTAL") return `Ranges are evaluated using total ${tierUnit || "unit"} volume across the family.`;
  if (basis === "PACK_COUNT") return "Ranges are evaluated by pack count.";
  if (basis === "UNIT_COUNT") return "Ranges are evaluated by unit count.";
  return "This pricing model uses a flat single-price tier.";
}

function inferPricingModelKey(pricing = {}) {
  if (pricing.pricingModelKey) return pricing.pricingModelKey;
  if (pricing.basis === "PACK_COUNT") return "BKT_1_5_6_10_11_PLUS";
  if (pricing.basis === "UNIT_COUNT") return "UNIT_1_20_21_PLUS";
  if (pricing.basis === "VOLUME_TOTAL") {
    const firstMax = pricing.tiers?.[0]?.max;
    return Number(firstMax) === 20 ? "TOTALVOL_L_1_20_21_PLUS" : "VOL_L_1_80_81_250_251_PLUS";
  }
  return "FLAT";
}

function modelForTiers(tiers = []) {
  return Array.isArray(tiers) && tiers.length > 1 ? "TIERED" : "FLAT";
}

function basisForPricingModel(pricingModelKey, fallback = "VOLUME_TOTAL") {
  if (pricingModelKey === "FLAT") return "FLAT";
  if (pricingModelKey.includes("BKT") || pricingModelKey.includes("PACK")) return "PACK_COUNT";
  if (pricingModelKey.includes("UNIT")) return "UNIT_COUNT";
  if (pricingModelKey.includes("VOL")) return "VOLUME_TOTAL";
  return fallback;
}

/* -----------------------------
   UI helpers
----------------------------- */
function fieldInputStyle(hasError = false) {
  return {
    width: "100%",
    height: 44,
    borderRadius: 15,
    border: "none",
    boxShadow: hasError ? "inset 0 0 0 1px rgba(180,35,24,.42)" : "inset 0 0 0 1px rgba(29,29,31,.06)",
    background: "rgba(245,245,247,.92)",
    padding: "0 14px",
    fontSize: 13.5,
    fontWeight: 600,
    color: "var(--color-ink, #1d1d1f)",
    outline: "none",
    transition: "box-shadow .16s ease, background .16s ease",
  };
}

function fieldTextareaStyle() {
  return { ...fieldInputStyle(), height: "auto", padding: 14, resize: "vertical", lineHeight: 1.5 };
}

function Field({ label, error, hint, children }) {
  return (
    <div style={{ display: "grid", gap: 7 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
        {label}
      </div>
      {children}
      {hint ? <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{hint}</div> : null}
      {error ? <div style={{ fontSize: 11.5, fontWeight: 600, color: "#b42318" }}>{error}</div> : null}
    </div>
  );
}

function CardLabel({ icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <DashboardIcon name={icon} size={14} strokeWidth={1.8} style={{ color: "var(--color-graphite, #707070)" }} />
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
        {children}
      </div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div style={{ display: "grid", gap: 3 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
        {label}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.4, fontWeight: 600, color: "var(--color-ink, #1d1d1f)", wordBreak: "break-word" }}>{value || "—"}</div>
    </div>
  );
}

function CloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      style={{
        width: 34,
        height: 34,
        borderRadius: 999,
        border: "none",
        background: "var(--color-fog, #f5f5f7)",
        color: "var(--color-graphite, #707070)",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <DashboardIcon name="close" size={15} strokeWidth={2} />
    </button>
  );
}

function TierLedgerEditor({ tierField, tiers, error, onAddTier, onUpdateTier, onRemoveTier }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <CardLabel icon="invoice">Tier Ledger</CardLabel>
        <GhostButton icon="plus" onClick={() => onAddTier(tierField)}>Add Tier</GhostButton>
      </div>

      {error ? <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 600, color: "#b42318" }}>{error}</div> : null}

      <div style={{ display: "grid", gap: 8 }}>
        {tiers.map((tier, index) => (
          <div key={index} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 38px", gap: 8, alignItems: "center", padding: 10, borderRadius: 12, background: "var(--color-fog, #f5f5f7)" }}>
            <input value={normalizeTierInputValue(tier.min)} onChange={(e) => onUpdateTier(tierField, index, "min", e.target.value)} placeholder="Min" style={fieldInputStyle()} />
            <input
              value={normalizeTierInputValue(tier.max)}
              onChange={(e) => onUpdateTier(tierField, index, "max", e.target.value === "" ? null : e.target.value)}
              placeholder="Max (empty = no limit)"
              style={fieldInputStyle()}
            />
            <input value={normalizeTierInputValue(tier.pricePerPack)} onChange={(e) => onUpdateTier(tierField, index, "pricePerPack", e.target.value)} placeholder="Price" style={fieldInputStyle()} />
            <button
              type="button"
              onClick={() => onRemoveTier(tierField, index)}
              disabled={tiers.length <= 1}
              aria-label="Remove tier"
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "none",
                background: "var(--color-snow, #fff)",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)",
                color: tiers.length <= 1 ? "rgba(0,0,0,.2)" : "#b42318",
                cursor: tiers.length <= 1 ? "not-allowed" : "pointer",
                display: "grid",
                placeItems: "center",
              }}
            >
              <DashboardIcon name="trash" size={14} strokeWidth={1.8} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -----------------------------
   Modal
----------------------------- */
function serializeEditorForm(form) {
  return JSON.stringify(form || {});
}

export default function ProductEditorModal({ product, categoryOptions = [], forceNewCategory = false, onClose, onBack, onSaved = async () => {} }) {
  const isEdit = Boolean(product?._id);
  const [addingCategory, setAddingCategory] = useState(forceNewCategory);
  const [newCategoryDraft, setNewCategoryDraft] = useState("");
  const [createProduct] = useCreateAdminProductMutation();
  const [updateProduct] = useUpdateAdminProductMutation();
  const [deleteProduct] = useDeleteAdminProductMutation();
  const [restoreProduct] = useRestoreAdminProductMutation();

  const [form, setForm] = useState(createInitialForm());
  const [initialFormSignature, setInitialFormSignature] = useState(() => serializeEditorForm(createInitialForm()));
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [pendingExit, setPendingExit] = useState(null);

  const resolvedCategoryOptions = useMemo(() => buildEditorCategoryOptions(categoryOptions, form.category), [categoryOptions, form.category]);
  const isDirty = useMemo(() => serializeEditorForm(form) !== initialFormSignature, [form, initialFormSignature]);

  useEffect(() => {
    if (!product) {
      const nextForm = createInitialForm();
      setForm(nextForm);
      setInitialFormSignature(serializeEditorForm(nextForm));
      setFieldErrors({});
      setFormError("");
      return;
    }

    const nextForm = {
      code: product.code || "",
      sku: product.sku || "",
      name: product.name || "",
      category: product.category || "",
      description: product.description || "",
      size: product.pack?.size ?? "",
      unit: product.pack?.unit || "L",
      currency: product.currency || "NPR",
      pricingModelKey: inferPricingModelKey(product.pricing || {}),
      basis: product.pricing?.basis || "VOLUME_TOTAL",
      tierUnit: product.pricing?.tierUnit || product.pack?.unit || "L",
      tiers:
        product.pricing?.tiers?.length > 0
          ? product.pricing.tiers.map((tier) => ({
              min: tier.min ?? "",
              max: tier.max ?? null,
              pricePerPack: tier.pricePerPack ?? tier.priceInclTax ?? tier.priceExclTax ?? "",
            }))
          : createDefaultTiers(),
      isActive: product.isActive !== false,
    };

    setForm(nextForm);
    setInitialFormSignature(serializeEditorForm(nextForm));
    setFieldErrors({});
    setFormError("");
  }, [product]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const packLabelPreview = useMemo(() => {
    if (form.size === "" || !form.unit) return "—";
    return `${form.size}${form.unit}`;
  }, [form.size, form.unit]);

  function updateField(key, value) {
    setForm((prev) => {
      if (key === "pricingModelKey") {
        return { ...prev, pricingModelKey: value, basis: basisForPricingModel(value, prev.basis) };
      }
      return { ...prev, [key]: value };
    });
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormError("");
  }

  function updateTier(tierField, index, key, value) {
    setForm((prev) => {
      const nextTiers = [...prev[tierField]];
      nextTiers[index] = { ...nextTiers[index], [key]: value };
      return { ...prev, [tierField]: nextTiers };
    });

    setFieldErrors((prev) => ({ ...prev, [tierField]: undefined }));
    setFormError("");
  }

  function addTier(tierField) {
    setForm((prev) => {
      const next = [...prev[tierField]];
      const last = next[next.length - 1];
      const lastMax = last?.max === null || last?.max === "" || last?.max === undefined ? null : Number(last.max);

      next.push({ min: lastMax !== null && !Number.isNaN(lastMax) ? lastMax + 1 : "", max: null, pricePerPack: "" });

      return { ...prev, [tierField]: next };
    });
  }

  function removeTier(tierField, index) {
    setForm((prev) => ({ ...prev, [tierField]: prev[tierField].filter((_, i) => i !== index) }));
  }

  function exitEditor(mode = "close") {
    if (mode === "back" && onBack) {
      onBack();
      return;
    }
    onClose();
  }

  function requestExit(mode = "close") {
    if (isDirty && !loading && !actionLoading) {
      setPendingExit(mode);
      return;
    }

    exitEditor(mode);
  }

  function discardAndExit() {
    const mode = pendingExit || "close";
    setPendingExit(null);
    exitEditor(mode);
  }

  function normalizeTiers(tiers) {
    return tiers.map((tier) => ({
      min: parseRequiredNumber(tier.min),
      max: tier.max === "" || tier.max === null ? null : parseRequiredNumber(tier.max),
      pricePerPack: parseRequiredNumber(tier.pricePerPack),
    }));
  }

  function validateTierSet(tiers) {
    const normalizedTiers = normalizeTiers(tiers);

    if (!Array.isArray(normalizedTiers) || normalizedTiers.length === 0) {
      return "At least one pricing tier is required.";
    }

    for (let i = 0; i < normalizedTiers.length; i += 1) {
      const tier = normalizedTiers[i];

      if (Number.isNaN(tier.min)) return `Tier ${i + 1}: minimum value is required.`;
      if (tier.max !== null && Number.isNaN(tier.max)) return `Tier ${i + 1}: maximum value must be numeric or empty.`;
      if (tier.max !== null && tier.max < tier.min) return `Tier ${i + 1}: maximum cannot be less than minimum.`;
      if (Number.isNaN(tier.pricePerPack) || tier.pricePerPack < 0) return `Tier ${i + 1}: price must be a valid non-negative number.`;

      if (i > 0) {
        const prev = normalizedTiers[i - 1];
        if (prev.max === null) return `Tier ${i}: cannot exist after an open-ended tier.`;
        if (tier.min <= prev.max) return `Tier ${i + 1}: minimum must be greater than previous maximum.`;
      }
    }

    return null;
  }

  function validateForm() {
    const nextErrors = {};

    if (!form.code.trim()) nextErrors.code = "Code is required.";
    if (!form.sku.trim()) nextErrors.sku = "SKU is required.";
    if (!form.name.trim()) nextErrors.name = "Name is required.";
    if (!form.category.trim()) nextErrors.category = "Category is required.";

    const packSize = parseRequiredNumber(form.size);
    if (Number.isNaN(packSize) || packSize <= 0) nextErrors.size = "Pack size must be a positive number.";
    if (!form.unit.trim()) nextErrors.unit = "Pack unit is required.";

    const tiersError = validateTierSet(form.tiers);
    if (tiersError) nextErrors.tiers = tiersError;

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit() {
    try {
      if (!validateForm()) return;

      setLoading(true);
      setFormError("");

      const payload = {
        code: form.code.trim(),
        sku: form.sku.trim(),
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim(),
        pack: { size: Number(form.size), unit: form.unit.trim(), label: `${form.size}${form.unit.trim()}` },
        currency: form.currency.trim() || "NPR",
        isActive: form.isActive,
        pricing: {
          model: form.pricingModelKey === "FLAT" || form.basis === "FLAT" ? "FLAT" : modelForTiers(form.tiers),
          pricingModelKey: form.pricingModelKey,
          basis: form.basis,
          tierUnit: form.tierUnit || form.unit.trim(),
          tiers: normalizeTiers(form.tiers),
        },
      };

      if (isEdit) {
        await updateProduct({ productId: product._id, payload }).unwrap();
      } else {
        await createProduct(payload).unwrap();
      }

      await onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setFormError("Failed to save product. Please review the fields and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate() {
    if (!product?._id) return;

    try {
      setActionLoading(true);
      setFormError("");
      await deleteProduct(product._id).unwrap();
      await onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setFormError("Failed to deactivate product.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRestore() {
    if (!product?._id) return;

    try {
      setActionLoading(true);
      setFormError("");
      await restoreProduct(product._id).unwrap();
      await onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setFormError("Failed to restore product.");
    } finally {
      setActionLoading(false);
    }
  }

  const pricingSummary = form.tiers.length === 1 ? "Flat rate" : `${form.tiers.length} tiers`;

  return (
    <div
      className="product-editor-overlay dash-modal-backdrop-in"
      onClick={() => requestExit("close")}
      style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(245,245,247,.82)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", display: "grid", placeItems: "center", padding: 24 }}
    >
      <div
        className="product-editor-dialog dash-modal-surface-in"
        onClick={(event) => event.stopPropagation()}
        style={{ width: "min(1080px, 100%)", maxHeight: "min(92dvh, 960px)", overflow: "auto", borderRadius: 32, border: "1px solid rgba(29,29,31,.1)", background: "rgba(255,255,255,.97)", padding: 24, color: "var(--color-ink, #1d1d1f)" }}
      >
        <style>{`
          .product-editor-dialog{
            scrollbar-width:thin;
            scrollbar-color:rgba(29,29,31,.18) transparent;
          }
          .product-editor-topbar{
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
            margin-bottom:12px;
          }
          .product-editor-back-btn{
            height:36px;
            padding:0 12px 0 10px;
            border:1px solid rgba(29,29,31,.08);
            border-radius:999px;
            background:var(--color-fog, #f5f5f7);
            color:var(--color-ink, #1d1d1f);
            display:inline-flex;
            align-items:center;
            gap:7px;
            font-size:13px;
            font-weight:700;
            cursor:pointer;
          }
          .product-editor-back-btn svg{
            transform:rotate(180deg);
          }
          .product-editor-discard-panel{
            position:fixed;
            inset:0;
            z-index:2;
            display:grid;
            place-items:center;
            padding:20px;
            background:rgba(245,245,247,.64);
            backdrop-filter:blur(14px);
            -webkit-backdrop-filter:blur(14px);
          }
          .product-editor-discard-card{
            width:min(420px, 100%);
            border-radius:26px;
            border:1px solid rgba(29,29,31,.1);
            background:rgba(255,255,255,.98);
            padding:18px;
            color:var(--color-ink, #1d1d1f);
          }
          .product-editor-discard-icon{
            width:40px;
            height:40px;
            border-radius:999px;
            display:grid;
            place-items:center;
            background:rgba(182,68,0,.09);
            color:var(--color-caution, #b64400);
          }
          .product-editor-discard-actions{
            margin-top:16px;
            display:flex;
            gap:8px;
            flex-wrap:wrap;
            justify-content:flex-end;
          }
          .product-editor-panel{
            border-radius:24px !important;
            background:rgba(255,255,255,.98) !important;
          }
          .product-editor-snapshot-card{
            border-radius:28px !important;
            background:linear-gradient(145deg, #ffffff 0%, #f5f5f7 100%) !important;
          }
          .product-editor-icon-stage{
            min-height:140px;
            border-radius:22px;
            background:
              radial-gradient(circle at 30% 25%, rgba(0,113,227,.12), transparent 30%),
              linear-gradient(145deg, #f5f5f7, #ffffff);
            display:grid;
            place-items:center;
            border:1px solid rgba(29,29,31,.06);
          }
          .product-editor-icon-core{
            width:64px;
            height:64px;
            border-radius:22px;
            background:var(--color-ink, #1d1d1f);
            color:#fff;
            display:grid;
            place-items:center;
          }
          .product-editor-footer-actions .admin-ui-ghost-btn,
          .product-editor-footer-actions .admin-ui-primary-btn{
            justify-content:center;
          }
          .product-editor-dialog input:focus,
          .product-editor-dialog textarea:focus{
            box-shadow:inset 0 0 0 1px rgba(0,113,227,.35), 0 0 0 4px rgba(0,113,227,.08) !important;
            background:#fff !important;
          }
          @media (max-width:880px){
            .product-editor-overlay{ padding:0 !important; align-items:stretch !important; }
            .product-editor-dialog{ width:100% !important; max-height:100dvh !important; border-radius:0 !important; padding:16px !important; }
            .product-editor-grid{ grid-template-columns:1fr !important; }
            .product-editor-snapshot{ position:static !important; }
            .product-field-grid{ grid-template-columns:1fr !important; }
            .product-editor-topbar{ align-items:flex-start; }
            .product-editor-footer-actions{ width:100%; }
            .product-editor-footer-actions > *{ flex:1 1 100%; }
            .product-editor-discard-actions > *{ flex:1 1 100%; justify-content:center; }
          }
        `}</style>

        {pendingExit ? (
          <div className="product-editor-discard-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Unsaved product edits">
            <div className="product-editor-discard-card">
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span className="product-editor-discard-icon">
                  <DashboardIcon name="warning" size={18} strokeWidth={2} />
                </span>
                <div>
                  <div style={{ fontSize: 20, lineHeight: 1.12, fontWeight: 800, letterSpacing: "-.03em" }}>Discard edit or continue editing?</div>
                  <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                    You have unsaved product changes. Discarding will close this editor without saving them.
                  </div>
                </div>
              </div>
              <div className="product-editor-discard-actions">
                <GhostButton onClick={() => setPendingExit(null)}>Continue editing</GhostButton>
                <GhostButton danger icon="trash" onClick={discardAndExit}>Discard edit</GhostButton>
              </div>
            </div>
          </div>
        ) : null}

        <div className="product-editor-topbar">
          {onBack ? (
            <button type="button" className="product-editor-back-btn" onClick={() => requestExit("back")}>
              <DashboardIcon name="chevron" size={14} strokeWidth={2} />
              Back to workspace
            </button>
          ) : <span />}
          <CloseButton onClick={() => requestExit("close")} />
        </div>

        <SectionHeader
          eyebrow="Admin Catalog"
          icon="package"
          title={isEdit ? "Edit Product Variant" : "Create Product Variant"}
          subtitle="Identity, pack setup, pricing, and availability in one clean workspace."
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Pill tone={isEdit ? "accent" : "positive"} size="small">{isEdit ? "Edit Mode" : "Create Mode"}</Pill>
            </div>
          }
        />

          {formError ? (
          <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>{formError}</div>
        ) : null}

        <div className="product-editor-grid" style={{ marginTop: 18, display: "grid", gridTemplateColumns: "minmax(240px,280px) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
          <aside className="product-editor-snapshot" style={{ position: "sticky", top: 0, display: "grid", gap: 14 }}>
            <Surface padding={16} className="product-editor-snapshot-card">
              <div className="product-editor-icon-stage">
                <div className="product-editor-icon-core">
                  <DashboardIcon name="package" size={28} strokeWidth={1.6} />
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <CardLabel icon="chart">Live Snapshot</CardLabel>
                <div style={{ marginTop: 8, fontSize: 18, lineHeight: 1.2, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-ink, #1d1d1f)" }}>
                  {form.name || "Untitled product"}
                </div>
                <div style={{ marginTop: 4, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{form.category || "No category selected"}</div>
              </div>

              <div style={{ marginTop: 14 }}>
                <SegmentedControl options={STATUS_OPTIONS} value={form.isActive ? "ACTIVE" : "INACTIVE"} onChange={(key) => updateField("isActive", key === "ACTIVE")} />
              </div>

              <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                <DetailItem label="Family code" value={form.code} />
                <DetailItem label="SKU" value={form.sku} />
                <DetailItem label="Pack" value={packLabelPreview} />
                <DetailItem label="Pricing" value={pricingSummary} />
              </div>
            </Surface>
          </aside>

          <div style={{ display: "grid", gap: 14 }}>
            <Surface padding={18} className="product-editor-panel">
              <SectionHeader icon="package" title="Product Identity" subtitle="Catalog definition" />

              <div className="product-field-grid" style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Product Name" error={fieldErrors.name}>
                  <input value={form.name} onChange={(e) => updateField("name", e.target.value)} style={fieldInputStyle(Boolean(fieldErrors.name))} />
                </Field>
                <Field
                  label="Category"
                  error={fieldErrors.category}
                  hint={addingCategory ? "New categories only appear in the catalog once this product is saved." : undefined}
                >
                  {addingCategory ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        autoFocus
                        value={newCategoryDraft}
                        onChange={(e) => {
                          setNewCategoryDraft(e.target.value);
                          updateField("category", normalizeNewCategoryValue(e.target.value));
                        }}
                        placeholder="e.g. Wood Stains"
                        style={{ ...fieldInputStyle(Boolean(fieldErrors.category)), flex: 1 }}
                      />
                      <GhostButton
                        icon="list"
                        onClick={() => {
                          setAddingCategory(false);
                          setNewCategoryDraft("");
                          updateField("category", "");
                        }}
                      >
                        Choose existing
                      </GhostButton>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <Dropdown
                        value={form.category}
                        onChange={(value) => updateField("category", value)}
                        options={toDropdownOptions(resolvedCategoryOptions)}
                        placeholder="Select category"
                        style={{ flex: 1 }}
                      />
                      <GhostButton icon="plus" onClick={() => setAddingCategory(true)}>New</GhostButton>
                    </div>
                  )}
                </Field>
                <Field label="Family Code" error={fieldErrors.code}>
                  <input value={form.code} onChange={(e) => updateField("code", e.target.value)} style={fieldInputStyle(Boolean(fieldErrors.code))} />
                </Field>
                <Field label="SKU" error={fieldErrors.sku}>
                  <input value={form.sku} onChange={(e) => updateField("sku", e.target.value)} style={fieldInputStyle(Boolean(fieldErrors.sku))} />
                </Field>
              </div>

              <div style={{ marginTop: 12 }}>
                <Field label="Short Description">
                  <textarea rows={3} value={form.description} onChange={(e) => updateField("description", e.target.value)} style={fieldTextareaStyle()} />
                </Field>
              </div>
            </Surface>

            <Surface padding={18} className="product-editor-panel">
              <SectionHeader icon="stock" title="Pack & Measurement" subtitle={`Pack label: ${packLabelPreview}`} />

              <div className="product-field-grid" style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Pack Size" error={fieldErrors.size}>
                  <input type="number" value={form.size} onChange={(e) => updateField("size", e.target.value)} style={fieldInputStyle(Boolean(fieldErrors.size))} />
                </Field>
                <Field label="Pack Unit" error={fieldErrors.unit}>
                  <Dropdown
                    value={form.unit}
                    onChange={(value) => {
                      updateField("unit", value);
                      updateField("tierUnit", value);
                    }}
                    options={toDropdownOptions(PACK_UNIT_OPTIONS)}
                  />
                </Field>
                <Field label="Currency" hint="Default catalog currency is NPR.">
                  <input value={form.currency} onChange={(e) => updateField("currency", e.target.value)} style={fieldInputStyle()} />
                </Field>
                <Field label="Tier Unit" hint="Controls pricing range labels.">
                  <Dropdown value={form.tierUnit} onChange={(value) => updateField("tierUnit", value)} options={toDropdownOptions(PACK_UNIT_OPTIONS)} />
                </Field>
              </div>
            </Surface>

            <Surface padding={18} className="product-editor-panel">
              <SectionHeader icon="invoice" title="Pricing" subtitle={getBasisHint(form.basis, form.tierUnit)} />

              <div className="product-field-grid" style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Pricing Model">
                  <Dropdown value={form.pricingModelKey} onChange={(value) => updateField("pricingModelKey", value)} options={toDropdownOptions(PRICING_MODEL_OPTIONS)} />
                </Field>
                <Field label="Pricing Basis">
                  <Dropdown value={form.basis} onChange={(value) => updateField("basis", value)} options={toDropdownOptions(BASIS_OPTIONS)} />
                </Field>
              </div>

              <div style={{ marginTop: 18 }}>
                <TierLedgerEditor tierField="tiers" tiers={form.tiers} error={fieldErrors.tiers} onAddTier={addTier} onUpdateTier={updateTier} onRemoveTier={removeTier} />
              </div>
            </Surface>

            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(0,113,227,.06)",
                color: "var(--color-azure, #0071e3)",
              }}
            >
              <DashboardIcon name="truck" size={14} strokeWidth={1.8} style={{ marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.5 }}>
                Dispatcher pricing for this SKU is configured per dispatcher, not here — open <strong>Dispatcher Price</strong> in the sidebar to set what each dispatcher pays.
              </span>
            </div>

            <Surface padding={18} className="product-editor-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div>
                  <CardLabel icon="gear">Administrative Controls</CardLabel>
                  <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>Save the current catalog variant or change its availability.</div>
                </div>

                <div className="product-editor-footer-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {isEdit && form.isActive ? (
                    <GhostButton danger icon="trash" onClick={handleDeactivate} disabled={actionLoading || loading}>
                      {actionLoading ? "Processing…" : "Deactivate"}
                    </GhostButton>
                  ) : null}

                  {isEdit && !form.isActive ? (
                    <GhostButton icon="refresh" onClick={handleRestore} disabled={actionLoading || loading}>
                      {actionLoading ? "Processing…" : "Restore"}
                    </GhostButton>
                  ) : null}

                  <PrimaryButton icon="checkmark" onClick={handleSubmit} disabled={loading || actionLoading}>
                    {loading ? "Saving…" : isEdit ? "Save Changes" : "Create Product"}
                  </PrimaryButton>
                </div>
              </div>
            </Surface>
          </div>
        </div>
      </div>
    </div>
  );
}
