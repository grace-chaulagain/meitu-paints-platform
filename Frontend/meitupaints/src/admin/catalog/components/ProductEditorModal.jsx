import { useEffect, useMemo, useState } from "react";
import {
  useCreateAdminProductMutation,
  useDeleteAdminProductMutation,
  useRestoreAdminProductMutation,
  useUpdateAdminProductMutation,
} from "../../../redux/api/meituApi.js";

/* -----------------------------
   constants
----------------------------- */
const PRICING_MODEL_OPTIONS = [
  {
    value: "VOL_L_1_80_81_250_251_PLUS",
    label: "Volume tiers",
  },
  {
    value: "TOTALVOL_L_1_20_21_PLUS",
    label: "Total volume tiers",
  },
  {
    value: "BKT_1_5_6_10_11_PLUS",
    label: "Bucket count tiers",
  },
  {
    value: "UNIT_1_20_21_PLUS",
    label: "Unit count tiers",
  },
  {
    value: "FLAT",
    label: "Flat",
  },
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

function categoryLabel(value) {
  if (!value) return "Uncategorized";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeCategoryOption(option) {
  const value =
    typeof option === "string"
      ? option
      : option?.value || option?.code || option?.category || "";
  const cleanValue = String(value || "").trim();

  if (!cleanValue || cleanValue === "ALL") return null;

  return {
    value: cleanValue,
    label:
      typeof option === "object" && option?.label
        ? String(option.label)
        : categoryLabel(cleanValue),
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

  return [
    SELECT_CATEGORY_OPTION,
    ...Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label)),
  ];
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
  if (basis === "VOLUME_TOTAL")
    return `Ranges are evaluated using total ${tierUnit || "unit"} volume across the family.`;
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
    return Number(firstMax) === 20
      ? "TOTALVOL_L_1_20_21_PLUS"
      : "VOL_L_1_80_81_250_251_PLUS";
  }
  return "FLAT";
}

function modelForTiers(tiers = []) {
  return Array.isArray(tiers) && tiers.length > 1 ? "TIERED" : "FLAT";
}

function basisForPricingModel(pricingModelKey, fallback = "VOLUME_TOTAL") {
  if (pricingModelKey === "FLAT") return "FLAT";
  if (pricingModelKey.includes("BKT") || pricingModelKey.includes("PACK")) {
    return "PACK_COUNT";
  }
  if (pricingModelKey.includes("UNIT")) return "UNIT_COUNT";
  if (pricingModelKey.includes("VOL")) return "VOLUME_TOTAL";
  return fallback;
}

/* -----------------------------
   UI shell
----------------------------- */
function ModalShell({ children, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      className="product-editor-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background:
          "linear-gradient(180deg, rgba(8,10,14,.54), rgba(8,10,14,.42))",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 3200,
        padding: "clamp(10px, 3vw, 24px)",
      }}
    >
      <div
        className="product-editor-dialog"
        style={{
          position: "relative",
          width: "min(1180px, 100%)",
          maxHeight: "min(92dvh, 980px)",
          overflow: "auto",
          borderRadius: 24,
          background:
            "linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.96))",
          padding: 24,
          border: "1px solid rgba(255,255,255,.78)",
          boxShadow:
            "0 32px 100px rgba(15,23,42,.22), inset 0 1px 0 rgba(255,255,255,.92)",
        }}
      >
        {children}

        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 38,
            height: 38,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,.06)",
            background: "rgba(255,255,255,.88)",
            fontSize: 16,
            fontWeight: 900,
            cursor: "pointer",
            color: "#0f172a",
            boxShadow: "0 10px 24px rgba(15,23,42,.08)",
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function SectionCard({ children, style = {} }) {
  return (
    <div
      style={{
        borderRadius: 22,
        background: "rgba(248,250,252,.92)",
        border: "1px solid rgba(15,23,42,.06)",
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "rgba(15,23,42,.48)",
      }}
    >
      {children}
    </div>
  );
}

function Input({ label, error, hint, ...props }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>
        {label}
      </div>
      <input
        {...props}
        style={{
          height: 46,
          borderRadius: 14,
          border: error
            ? "1px solid rgba(180,35,24,.35)"
            : "1px solid rgba(0,0,0,.1)",
          padding: "0 14px",
          fontWeight: 700,
          outline: "none",
          background: "#fff",
          color: "#0f172a",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.9)",
        }}
      />
      {hint ? (
        <div
          style={{ fontSize: 11, color: "rgba(0,0,0,.45)", fontWeight: 600 }}
        >
          {hint}
        </div>
      ) : null}
      {error ? (
        <div style={{ fontSize: 11, color: "#b42318", fontWeight: 700 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}

function TextArea({ label, error, ...props }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>
        {label}
      </div>
      <textarea
        {...props}
        style={{
          minHeight: 110,
          borderRadius: 14,
          border: error
            ? "1px solid rgba(180,35,24,.35)"
            : "1px solid rgba(0,0,0,.1)",
          padding: "12px 14px",
          fontWeight: 700,
          outline: "none",
          background: "#fff",
          color: "#0f172a",
          resize: "vertical",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.9)",
        }}
      />
      {error ? (
        <div style={{ fontSize: 11, color: "#b42318", fontWeight: 700 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}

function Select({ label, options = [], error, hint, ...props }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>
        {label}
      </div>
      <select
        {...props}
        style={{
          height: 46,
          borderRadius: 14,
          border: error
            ? "1px solid rgba(180,35,24,.35)"
            : "1px solid rgba(0,0,0,.1)",
          padding: "0 14px",
          fontWeight: 700,
          outline: "none",
          background: "#fff",
          color: "#0f172a",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.9)",
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <div
          style={{ fontSize: 11, color: "rgba(0,0,0,.45)", fontWeight: 600 }}
        >
          {hint}
        </div>
      ) : null}
      {error ? (
        <div style={{ fontSize: 11, color: "#b42318", fontWeight: 700 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}

function TierInput({ value, onChange, placeholder, error }) {
  return (
    <input
      value={value ?? ""}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        height: 44,
        borderRadius: 12,
        border: error
          ? "1px solid rgba(180,35,24,.35)"
          : "1px solid rgba(0,0,0,.08)",
        padding: "0 12px",
        fontWeight: 700,
        outline: "none",
        width: "100%",
        background: "#fff",
        color: "#0f172a",
      }}
    />
  );
}

function Pill({ children, active = false }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 12px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        background: active ? "rgba(196,0,0,.08)" : "rgba(15,23,42,.05)",
        color: active ? "#b42318" : "rgba(15,23,42,.62)",
        border: active
          ? "1px solid rgba(196,0,0,.12)"
          : "1px solid rgba(15,23,42,.06)",
      }}
    >
      {children}
    </div>
  );
}

function SnapshotValue({ label, value }) {
  return (
    <div
      style={{
        padding: "12px 0",
        borderBottom: "1px solid rgba(15,23,42,.07)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "rgba(15,23,42,.42)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 5,
          fontSize: 14,
          lineHeight: 1.35,
          fontWeight: 850,
          color: "#0f172a",
          wordBreak: "break-word",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function ProductEditorStyles() {
  return (
    <style>{`
      .product-editor-head{
        display:flex;
        justify-content:space-between;
        gap:18px;
        align-items:flex-start;
        margin-bottom:18px;
        padding:2px 46px 0 2px;
      }

      .product-editor-title{
        margin-top:8px;
        font-size:32px;
        line-height:1;
        font-weight:950;
        letter-spacing:-.045em;
        color:#0f172a;
      }

      .product-editor-subtitle{
        margin:9px 0 0;
        font-size:14px;
        line-height:1.6;
        font-weight:700;
        color:rgba(15,23,42,.58);
        max-width:720px;
      }

      .product-editor-grid{
        display:grid;
        grid-template-columns:minmax(260px,310px) minmax(0,1fr);
        gap:18px;
        align-items:start;
      }

      .product-editor-snapshot{
        position:sticky;
        top:0;
        display:grid;
        gap:14px;
      }

      .product-preview-tile{
        min-height:220px;
        border-radius:22px;
        background:
          radial-gradient(circle at 25% 20%, rgba(180,35,24,.13), transparent 30%),
          linear-gradient(145deg,#ffffff,#eef2f7);
        border:1px solid rgba(15,23,42,.07);
        display:grid;
        place-items:center;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.9);
      }

      .product-preview-mark{
        width:92px;
        height:92px;
        border-radius:24px;
        background:linear-gradient(135deg,#b42318,#ec6f3b);
        color:#fff;
        display:grid;
        place-items:center;
        font-size:42px;
        font-weight:950;
        letter-spacing:-.06em;
        box-shadow:0 24px 50px rgba(180,35,24,.22);
      }

      .product-editor-main{
        display:grid;
        gap:16px;
        min-width:0;
      }

      .product-section-head{
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:14px;
        margin-bottom:16px;
        flex-wrap:wrap;
      }

      .product-section-title{
        margin-top:6px;
        font-size:18px;
        font-weight:950;
        letter-spacing:-.03em;
        color:#0f172a;
      }

      .product-field-grid{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:14px;
      }

      .product-tier-row{
        display:grid;
        grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 42px;
        gap:10px;
        align-items:center;
        padding:12px;
        border-radius:16px;
        background:rgba(255,255,255,.88);
        border:1px solid rgba(15,23,42,.06);
      }

      .product-editor-actions{
        display:flex;
        justify-content:space-between;
        gap:14px;
        align-items:center;
        flex-wrap:wrap;
      }

      .product-status-toggle{
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px;
      }

      .product-status-toggle button{
        min-height:38px;
        border-radius:12px;
        border:1px solid rgba(15,23,42,.08);
        background:#fff;
        color:rgba(15,23,42,.58);
        font-size:12px;
        font-weight:900;
        cursor:pointer;
        transition:background .16s ease,color .16s ease,border-color .16s ease;
      }

      .product-status-toggle button.active{
        border-color:rgba(180,35,24,.16);
        background:rgba(180,35,24,.08);
        color:#b42318;
      }

      @media (max-width:880px){
        .product-editor-overlay{
          align-items:stretch !important;
          overflow:auto !important;
        }
        .product-editor-dialog{
          max-height:none !important;
          min-height:calc(100dvh - 20px) !important;
          border-radius:22px !important;
          padding:16px !important;
        }
        .product-editor-head,
        .product-editor-grid{
          display:grid;
          grid-template-columns:1fr;
        }

        .product-editor-head{ padding-right:46px; }
        .product-editor-snapshot{ position:static; }
        .product-field-grid,
        .product-tier-row{
          grid-template-columns:1fr;
        }
        .product-tier-row button{ width:100%; }
      }
      @media (max-width:520px){
        .product-editor-title{
          font-size:clamp(25px, 8vw, 30px);
        }
        .product-editor-subtitle{
          font-size:13px;
          line-height:1.5;
        }
        .product-editor-dialog{
          padding:14px !important;
        }
        .product-preview-tile{
          min-height:160px;
        }
      }
    `}</style>
  );
}

/* -----------------------------
   Modal
----------------------------- */
export default function ProductEditorModal({
  product,
  categoryOptions = [],
  onClose,
  onSaved = async () => {},
}) {
  const isEdit = Boolean(product?._id);
  const [createProduct] = useCreateAdminProductMutation();
  const [updateProduct] = useUpdateAdminProductMutation();
  const [deleteProduct] = useDeleteAdminProductMutation();
  const [restoreProduct] = useRestoreAdminProductMutation();

  const [form, setForm] = useState(createInitialForm());
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const resolvedCategoryOptions = useMemo(
    () => buildEditorCategoryOptions(categoryOptions, form.category),
    [categoryOptions, form.category],
  );

  useEffect(() => {
    if (!product) {
      setForm(createInitialForm());
      setFieldErrors({});
      setFormError("");
      return;
    }

    setForm({
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
              pricePerPack:
                tier.pricePerPack ??
                tier.priceInclTax ??
                tier.priceExclTax ??
                "",
            }))
          : createDefaultTiers(),
      isActive: product.isActive !== false,
    });

    setFieldErrors({});
    setFormError("");
  }, [product]);

  const packLabelPreview = useMemo(() => {
    if (form.size === "" || !form.unit) return "—";
    return `${form.size}${form.unit}`;
  }, [form.size, form.unit]);

  const statusLabel = form.isActive ? "Active" : "Inactive";

  function updateField(key, value) {
    setForm((prev) => {
      if (key !== "pricingModelKey") return { ...prev, [key]: value };
      return {
        ...prev,
        pricingModelKey: value,
        basis: basisForPricingModel(value, prev.basis),
      };
    });
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setFormError("");
  }

  function updateTier(index, key, value) {
    setForm((prev) => {
      const nextTiers = [...prev.tiers];
      nextTiers[index] = {
        ...nextTiers[index],
        [key]: value,
      };

      return {
        ...prev,
        tiers: nextTiers,
      };
    });

    setFieldErrors((prev) => ({ ...prev, tiers: undefined }));
    setFormError("");
  }

  function addTier() {
    setForm((prev) => {
      const next = [...prev.tiers];
      const last = next[next.length - 1];
      const lastMax =
        last?.max === null || last?.max === "" || last?.max === undefined
          ? null
          : Number(last.max);

      next.push({
        min: lastMax !== null && !Number.isNaN(lastMax) ? lastMax + 1 : "",
        max: null,
        pricePerPack: "",
      });

      return {
        ...prev,
        tiers: next,
      };
    });
  }

  function removeTier(index) {
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.filter((_, i) => i !== index),
    }));
  }

  function normalizeTiersForSubmit() {
    return form.tiers.map((tier) => ({
      min: parseRequiredNumber(tier.min),
      max:
        tier.max === "" || tier.max === null
          ? null
          : parseRequiredNumber(tier.max),
      pricePerPack: parseRequiredNumber(tier.pricePerPack),
    }));
  }

  function validateForm() {
    const nextErrors = {};

    if (!form.code.trim()) nextErrors.code = "Code is required.";
    if (!form.sku.trim()) nextErrors.sku = "SKU is required.";
    if (!form.name.trim()) nextErrors.name = "Name is required.";
    if (!form.category.trim()) nextErrors.category = "Category is required.";

    const packSize = parseRequiredNumber(form.size);
    if (Number.isNaN(packSize) || packSize <= 0) {
      nextErrors.size = "Pack size must be a positive number.";
    }

    if (!form.unit.trim()) {
      nextErrors.unit = "Pack unit is required.";
    }

    const normalizedTiers = normalizeTiersForSubmit();

    if (!Array.isArray(normalizedTiers) || normalizedTiers.length === 0) {
      nextErrors.tiers = "At least one pricing tier is required.";
    } else {
      for (let i = 0; i < normalizedTiers.length; i += 1) {
        const tier = normalizedTiers[i];

        if (Number.isNaN(tier.min)) {
          nextErrors.tiers = `Tier ${i + 1}: minimum value is required.`;
          break;
        }

        if (tier.max !== null && Number.isNaN(tier.max)) {
          nextErrors.tiers = `Tier ${i + 1}: maximum value must be numeric or empty.`;
          break;
        }

        if (tier.max !== null && tier.max < tier.min) {
          nextErrors.tiers = `Tier ${i + 1}: maximum cannot be less than minimum.`;
          break;
        }

        if (Number.isNaN(tier.pricePerPack) || tier.pricePerPack < 0) {
          nextErrors.tiers = `Tier ${i + 1}: price must be a valid non-negative number.`;
          break;
        }

        if (i > 0) {
          const prev = normalizedTiers[i - 1];

          if (prev.max === null) {
            nextErrors.tiers = `Tier ${i}: cannot exist after an open-ended tier.`;
            break;
          }

          if (tier.min <= prev.max) {
            nextErrors.tiers = `Tier ${i + 1}: minimum must be greater than previous maximum.`;
            break;
          }
        }
      }
    }

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
        pack: {
          size: Number(form.size),
          unit: form.unit.trim(),
          label: `${form.size}${form.unit.trim()}`,
        },
        currency: form.currency.trim() || "NPR",
        isActive: form.isActive,
        pricing: {
          model:
            form.pricingModelKey === "FLAT" || form.basis === "FLAT"
              ? "FLAT"
              : modelForTiers(form.tiers),
          pricingModelKey: form.pricingModelKey,
          basis: form.basis,
          tierUnit: form.tierUnit || form.unit.trim(),
          tiers: normalizeTiersForSubmit(),
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
      setFormError(
        "Failed to save product. Please review the fields and try again.",
      );
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

  const productInitial = (form.name || form.code || "M")
    .trim()
    .slice(0, 1)
    .toUpperCase();
  const pricingSummary =
    form.tiers.length === 1 ? "Flat rate" : `${form.tiers.length} tiers`;

  return (
    <ModalShell onClose={onClose}>
      <ProductEditorStyles />

      <div className="product-editor-head">
        <div>
          <SectionLabel>Admin Catalog</SectionLabel>
          <div className="product-editor-title">
            {isEdit ? "Edit Product Variant" : "Create Product Variant"}
          </div>
          <p className="product-editor-subtitle">
            Update identity, pack configuration, pricing, and availability from
            a focused catalog management surface.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Pill active={isEdit}>{isEdit ? "Edit Mode" : "Create Mode"}</Pill>
          <Pill active={form.isActive}>{statusLabel}</Pill>
        </div>
      </div>

      {formError ? (
        <div
          style={{
            marginBottom: 18,
            padding: "14px 16px",
            borderRadius: 16,
            border: "1px solid rgba(180,35,24,.16)",
            background: "rgba(180,35,24,.08)",
            color: "#b42318",
            fontWeight: 800,
            lineHeight: 1.55,
          }}
        >
          {formError}
        </div>
      ) : null}

      <div className="product-editor-grid">
        <aside className="product-editor-snapshot">
          <SectionCard style={{ background: "#fff" }}>
            <div className="product-preview-tile">
              <div className="product-preview-mark">{productInitial}</div>
            </div>

            <div style={{ marginTop: 16 }}>
              <SectionLabel>Live Snapshot</SectionLabel>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 22,
                  lineHeight: 1.12,
                  fontWeight: 950,
                  letterSpacing: "-0.04em",
                  color: "#0f172a",
                }}
              >
                {form.name || "Untitled product"}
              </div>
              <div
                style={{
                  marginTop: 7,
                  fontSize: 13,
                  fontWeight: 750,
                  color: "rgba(15,23,42,.58)",
                }}
              >
                {form.category || "No category selected"}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div className="product-status-toggle">
                <button
                  type="button"
                  className={form.isActive ? "active" : ""}
                  onClick={() => updateField("isActive", true)}
                >
                  Active
                </button>
                <button
                  type="button"
                  className={!form.isActive ? "active" : ""}
                  onClick={() => updateField("isActive", false)}
                >
                  Inactive
                </button>
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <SnapshotValue label="Family code" value={form.code} />
              <SnapshotValue label="SKU" value={form.sku} />
              <SnapshotValue label="Pack" value={packLabelPreview} />
              <SnapshotValue label="Pricing" value={pricingSummary} />
            </div>
          </SectionCard>
        </aside>

        <div className="product-editor-main">
          <SectionCard>
            <div className="product-section-head">
              <div>
                <SectionLabel>Product Identity</SectionLabel>
                <div className="product-section-title">Catalog definition</div>
              </div>
              <Pill active={form.isActive}>{statusLabel}</Pill>
            </div>

            <div className="product-field-grid">
              <Input
                label="Product Name"
                value={form.name}
                error={fieldErrors.name}
                onChange={(e) => updateField("name", e.target.value)}
              />

              <Select
                label="Category"
                value={form.category}
                error={fieldErrors.category}
                onChange={(e) => updateField("category", e.target.value)}
                options={resolvedCategoryOptions}
              />

              <Input
                label="Family Code"
                value={form.code}
                error={fieldErrors.code}
                onChange={(e) => updateField("code", e.target.value)}
              />

              <Input
                label="SKU"
                value={form.sku}
                error={fieldErrors.sku}
                onChange={(e) => updateField("sku", e.target.value)}
              />
            </div>

            <div style={{ marginTop: 14 }}>
              <TextArea
                label="Short Description"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
              />
            </div>
          </SectionCard>

          <SectionCard>
            <div className="product-section-head">
              <div>
                <SectionLabel>Pack & Measurement</SectionLabel>
                <div className="product-section-title">Variant configuration</div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 850,
                  color: "rgba(15,23,42,.56)",
                }}
              >
                Pack label:{" "}
                <span style={{ color: "#0f172a" }}>{packLabelPreview}</span>
              </div>
            </div>

            <div className="product-field-grid">
              <Input
                label="Pack Size"
                value={form.size}
                error={fieldErrors.size}
                onChange={(e) => updateField("size", e.target.value)}
                type="number"
              />

              <Select
                label="Pack Unit"
                value={form.unit}
                error={fieldErrors.unit}
                onChange={(e) => {
                  updateField("unit", e.target.value);
                  updateField("tierUnit", e.target.value);
                }}
                options={PACK_UNIT_OPTIONS}
              />

              <Input
                label="Currency"
                value={form.currency}
                onChange={(e) => updateField("currency", e.target.value)}
                hint="Default catalog currency is NPR."
              />

              <Select
                label="Tier Unit"
                value={form.tierUnit}
                onChange={(e) => updateField("tierUnit", e.target.value)}
                options={PACK_UNIT_OPTIONS}
                hint="Controls pricing range labels."
              />
            </div>
          </SectionCard>

          <SectionCard>
            <div className="product-section-head">
              <div>
                <SectionLabel>Pricing</SectionLabel>
                <div className="product-section-title">Rate structure</div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(15,23,42,.52)",
                  fontWeight: 750,
                  maxWidth: 420,
                  lineHeight: 1.5,
                }}
              >
                {getBasisHint(form.basis, form.tierUnit)}
              </div>
            </div>

            <div className="product-field-grid">
              <Select
                label="Pricing Model"
                value={form.pricingModelKey}
                onChange={(e) => updateField("pricingModelKey", e.target.value)}
                options={PRICING_MODEL_OPTIONS}
              />

              <Select
                label="Pricing Basis"
                value={form.basis}
                onChange={(e) => updateField("basis", e.target.value)}
                options={BASIS_OPTIONS}
              />
            </div>

            <div style={{ marginTop: 20 }}>
              <div className="product-section-head" style={{ marginBottom: 12 }}>
                <div>
                  <SectionLabel>Tier Ledger</SectionLabel>
                  <div className="product-section-title">Price ranges</div>
                </div>

                <button
                  type="button"
                  onClick={addTier}
                  style={{
                    minHeight: 40,
                    padding: "0 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(15,23,42,.08)",
                    background: "#fff",
                    fontWeight: 900,
                    cursor: "pointer",
                    color: "#0f172a",
                  }}
                >
                  Add Tier
                </button>
              </div>

              {fieldErrors.tiers ? (
                <div
                  style={{
                    marginBottom: 12,
                    fontSize: 12,
                    color: "#b42318",
                    fontWeight: 800,
                  }}
                >
                  {fieldErrors.tiers}
                </div>
              ) : null}

              <div style={{ display: "grid", gap: 10 }}>
                {form.tiers.map((tier, index) => (
                  <div className="product-tier-row" key={index}>
                    <TierInput
                      placeholder="Min"
                      value={normalizeTierInputValue(tier.min)}
                      onChange={(e) =>
                        updateTier(index, "min", e.target.value)
                      }
                    />

                    <TierInput
                      placeholder="Max (empty = no limit)"
                      value={normalizeTierInputValue(tier.max)}
                      onChange={(e) =>
                        updateTier(
                          index,
                          "max",
                          e.target.value === "" ? null : e.target.value,
                        )
                      }
                    />

                    <TierInput
                      placeholder="Price"
                      value={normalizeTierInputValue(tier.pricePerPack)}
                      onChange={(e) =>
                        updateTier(index, "pricePerPack", e.target.value)
                      }
                    />

                    <button
                      type="button"
                      onClick={() => removeTier(index)}
                      disabled={form.tiers.length <= 1}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        border: "1px solid rgba(15,23,42,.08)",
                        background: "#fff",
                        color:
                          form.tiers.length <= 1
                            ? "rgba(15,23,42,.25)"
                            : "#b42318",
                        fontWeight: 950,
                        cursor:
                          form.tiers.length <= 1 ? "not-allowed" : "pointer",
                        fontSize: 16,
                      }}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,.96), rgba(248,250,252,.95))",
            }}
          >
            <div className="product-editor-actions">
              <div>
                <SectionLabel>Administrative Controls</SectionLabel>
                <div
                  style={{
                    marginTop: 7,
                    fontSize: 13,
                    fontWeight: 750,
                    color: "rgba(15,23,42,.58)",
                  }}
                >
                  Save the current catalog variant or change its availability.
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {isEdit && form.isActive ? (
                  <button
                    type="button"
                    onClick={handleDeactivate}
                    disabled={actionLoading || loading}
                    style={{
                      height: 44,
                      padding: "0 16px",
                      borderRadius: 12,
                      border: "1px solid rgba(180,35,24,.16)",
                      background: "rgba(180,35,24,.08)",
                      color: "#b42318",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {actionLoading ? "Processing..." : "Deactivate"}
                  </button>
                ) : null}

                {isEdit && !form.isActive ? (
                  <button
                    type="button"
                    onClick={handleRestore}
                    disabled={actionLoading || loading}
                    style={{
                      height: 44,
                      padding: "0 16px",
                      borderRadius: 12,
                      border: "1px solid rgba(16,163,74,.14)",
                      background: "rgba(16,163,74,.08)",
                      color: "#067647",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {actionLoading ? "Processing..." : "Restore"}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || actionLoading}
                  style={{
                    height: 46,
                    padding: "0 20px",
                    borderRadius: 12,
                    border: "none",
                    background: "linear-gradient(135deg,#b42318,#f06a32)",
                    color: "#fff",
                    fontWeight: 950,
                    cursor: "pointer",
                    boxShadow: "0 16px 34px rgba(180,35,24,.18)",
                  }}
                >
                  {loading
                    ? "Saving..."
                    : isEdit
                      ? "Save Changes"
                      : "Create Product"}
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </ModalShell>
  );
}
