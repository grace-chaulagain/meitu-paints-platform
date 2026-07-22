import { useEffect, useMemo, useState } from "react";
import { MobileSheet } from "../../dealer/mobile/MobileSheet.jsx";
import { PrimaryButton } from "../../dealer/mobile/PrimaryButton.jsx";
import { SegmentedControl } from "../../dealer/mobile/SegmentedControl.jsx";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { toast } from "../../dealer/mobile/useToast.js";
import {
  useCreateAdminProductMutation,
  useUpdateAdminProductMutation,
  useDeleteAdminProductMutation,
  useRestoreAdminProductMutation,
  useUploadAdminProductImageMutation,
  useDeleteAdminProductImageMutation,
} from "../../redux/api/meituApi.js";

// Mobile counterpart to admin/catalog/components/ProductEditorModal.jsx -
// same fields, same validation, same save payload shape, reused verbatim
// (this file's helpers below are direct copies, since none of them are
// exported from that module). Deliberately drops the desktop modal's
// "Bundle / Kit Components" section (a search-picker + per-row quantity
// stepper for rare, admin-only kit assembly) - out of scope for this pass,
// same reasoning as Orders mobile leaving Amend/Delete desktop-only.
// Editing a product that already has kit components here leaves its
// `components` array untouched (never sent in the payload), so nothing is
// silently wiped by editing a kitted product from a phone.
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
  return String(value).replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeNewCategoryValue(input) {
  return String(input || "").trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
}

function normalizeCategoryOption(option) {
  const value = typeof option === "string" ? option : option?.value || option?.code || option?.category || "";
  const cleanValue = String(value || "").trim();
  if (!cleanValue || cleanValue === "ALL") return null;
  return { value: cleanValue, label: typeof option === "object" && option?.label ? String(option.label) : categoryLabel(cleanValue) };
}

function buildCategoryOptions(categoryOptions = [], currentCategory = "") {
  const map = new Map();
  for (const option of categoryOptions) {
    const normalized = normalizeCategoryOption(option);
    if (normalized) map.set(normalized.value, normalized);
  }
  const current = normalizeCategoryOption(currentCategory);
  if (current && !map.has(current.value)) map.set(current.value, current);
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function createDefaultTiers() {
  return [
    { min: 1, max: 80, pricePerPack: "" },
    { min: 81, max: 250, pricePerPack: "" },
    { min: 251, max: null, pricePerPack: "" },
  ];
}

function createInitialForm(prefill) {
  return {
    code: prefill?.code || "",
    sku: "",
    name: prefill?.name || "",
    category: prefill?.category || "",
    description: prefill?.description || "",
    size: "",
    unit: "L",
    currency: "NPR",
    pricingModelKey: "VOL_L_1_80_81_250_251_PLUS",
    basis: "VOLUME_TOTAL",
    tierUnit: "L",
    tiers: createDefaultTiers(),
    isActive: true,
    sellable: true,
  };
}

function formFromProduct(product) {
  return {
    code: product.code || "",
    sku: product.sku || "",
    name: product.name || "",
    category: product.category || "",
    description: product.description || "",
    size: product.pack?.size ?? "",
    unit: product.pack?.unit || "L",
    currency: product.currency || "NPR",
    pricingModelKey: product.pricing?.pricingModelKey || "VOL_L_1_80_81_250_251_PLUS",
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
    sellable: product.sellable !== false,
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

function normalizeTiers(tiers) {
  return tiers.map((tier) => ({
    min: parseRequiredNumber(tier.min),
    max: tier.max === "" || tier.max === null ? null : parseRequiredNumber(tier.max),
    pricePerPack: parseRequiredNumber(tier.pricePerPack),
  }));
}

function validateTierSet(tiers) {
  const normalizedTiers = normalizeTiers(tiers);
  if (!normalizedTiers.length) return "At least one pricing tier is required.";

  for (let i = 0; i < normalizedTiers.length; i += 1) {
    const tier = normalizedTiers[i];
    if (Number.isNaN(tier.min)) return `Tier ${i + 1}: minimum value is required.`;
    if (tier.max !== null && Number.isNaN(tier.max)) return `Tier ${i + 1}: maximum must be numeric or empty.`;
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

function modelForTiers(tiers = []) {
  return Array.isArray(tiers) && tiers.length > 1 ? "TIERED" : "FLAT";
}

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

export function AdminProductEditorSheet({ open, product, prefill, categoryOptions, onClose, onSaved }) {
  const isEdit = Boolean(product?._id);
  const [form, setForm] = useState(() => (product ? formFromProduct(product) : createInitialForm(prefill)));
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryDraft, setNewCategoryDraft] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState(product?.images || []);
  const [imageBusy, setImageBusy] = useState(false);

  const [createProduct] = useCreateAdminProductMutation();
  const [updateProduct] = useUpdateAdminProductMutation();
  const [deleteProduct] = useDeleteAdminProductMutation();
  const [restoreProduct] = useRestoreAdminProductMutation();
  const [uploadProductImage] = useUploadAdminProductImageMutation();
  const [deleteProductImage] = useDeleteAdminProductImageMutation();

  useEffect(() => {
    if (!open) return;
    setForm(product ? formFromProduct(product) : createInitialForm(prefill));
    setImages(product?.images || []);
    setError("");
    setAddingCategory(false);
    setNewCategoryDraft("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?._id]);

  const resolvedCategoryOptions = useMemo(() => buildCategoryOptions(categoryOptions, form.category), [categoryOptions, form.category]);
  const primaryImage = getPrimaryImage(images);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  function updateTier(index, key, value) {
    setForm((prev) => {
      const next = [...prev.tiers];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, tiers: next };
    });
    setError("");
  }

  function addTier() {
    setForm((prev) => {
      const last = prev.tiers[prev.tiers.length - 1];
      const lastMax = last?.max === null || last?.max === "" || last?.max === undefined ? null : Number(last.max);
      return { ...prev, tiers: [...prev.tiers, { min: lastMax !== null && !Number.isNaN(lastMax) ? lastMax + 1 : "", max: null, pricePerPack: "" }] };
    });
  }

  function removeTier(index) {
    setForm((prev) => ({ ...prev, tiers: prev.tiers.filter((_, i) => i !== index) }));
  }

  function handleUploadImage() {
    if (!product?._id) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        setImageBusy(true);
        const updated = await uploadProductImage({ productId: product._id, file }).unwrap();
        setImages(updated?.images || []);
      } catch {
        toast("Failed to upload image");
      } finally {
        setImageBusy(false);
      }
    };
    input.click();
  }

  async function handleRemoveImage() {
    if (!product?._id || !primaryImage?.publicId) return;
    try {
      setImageBusy(true);
      const updated = await deleteProductImage({ productId: product._id, publicId: primaryImage.publicId }).unwrap();
      setImages(updated?.images || []);
    } catch {
      toast("Failed to remove image");
    } finally {
      setImageBusy(false);
    }
  }

  function validateForm() {
    if (!form.code.trim()) return "Family code is required.";
    if (!form.sku.trim()) return "SKU is required.";
    if (!form.name.trim()) return "Name is required.";
    if (!form.category.trim()) return "Category is required.";
    const packSize = parseRequiredNumber(form.size);
    if (Number.isNaN(packSize) || packSize <= 0) return "Pack size must be a positive number.";
    if (!form.unit.trim()) return "Pack unit is required.";
    return validateTierSet(form.tiers);
  }

  async function handleSubmit() {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    try {
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
        sellable: form.sellable,
      };

      if (isEdit) {
        await updateProduct({ productId: product._id, payload }).unwrap();
        toast(`${form.name} updated`);
      } else {
        await createProduct(payload).unwrap();
        toast(`${form.name} created`);
      }
      onSaved();
    } catch (err) {
      setError(err?.data?.message || err?.message || "Failed to save product. Please review the fields and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!product?._id) return;
    setSaving(true);
    try {
      await deleteProduct(product._id).unwrap();
      toast(`${product.name} deactivated`);
      onSaved();
    } catch {
      setError("Failed to deactivate product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore() {
    if (!product?._id) return;
    setSaving(true);
    try {
      await restoreProduct(product._id).unwrap();
      toast(`${product.name} restored`);
      onSaved();
    } catch {
      setError("Failed to restore product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileSheet
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      height="full"
      ariaLabel={isEdit ? "Edit product" : "New product"}
      footer={
        <PrimaryButton onClick={handleSubmit} loading={saving}>
          {isEdit ? "Save Changes" : "Create Variant"}
        </PrimaryButton>
      }
    >
      <div className="dealer-m-newsale-title">{isEdit ? form.name || "Edit product" : "New product variant"}</div>

      {isEdit ? (
        <div style={{ marginTop: 16, display: "flex", gap: 14, alignItems: "flex-start" }}>
          <span className="admin-m-image-well">
            {primaryImage?.url ? <img src={primaryImage.url} alt="" /> : <DashboardIcon name="package" size={28} strokeWidth={1.5} />}
          </span>
          <div style={{ flex: 1 }}>
            <div className="admin-m-image-actions" style={{ marginTop: 0 }}>
              <button type="button" className="admin-m-image-btn" onClick={handleUploadImage} disabled={imageBusy}>
                {primaryImage ? "Replace" : "Add image"}
              </button>
              {primaryImage ? (
                <button type="button" className="admin-m-image-btn danger" onClick={handleRemoveImage} disabled={imageBusy}>
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="dealer-m-newsale-field-label" style={{ marginTop: 20 }}>
        Status
      </div>
      <div style={{ marginTop: 8 }}>
        <SegmentedControl
          options={[
            { key: "true", label: "Active" },
            { key: "false", label: "Inactive" },
          ]}
          value={String(form.isActive)}
          onChange={(value) => updateField("isActive", value === "true")}
        />
      </div>

      <div className="dealer-m-newsale-field-label">Name</div>
      <input className="dealer-m-newsale-input" value={form.name} onChange={(e) => updateField("name", e.target.value)} />

      <div className="dealer-m-newsale-field-label">Category</div>
      {addingCategory ? (
        <input
          className="dealer-m-newsale-input"
          value={newCategoryDraft}
          onChange={(e) => setNewCategoryDraft(e.target.value)}
          onBlur={() => {
            const normalized = normalizeNewCategoryValue(newCategoryDraft);
            if (normalized) updateField("category", normalized);
            setAddingCategory(false);
          }}
          placeholder="e.g. WOOD STAINS"
          autoFocus
        />
      ) : (
        <select
          className="admin-m-select"
          value={form.category}
          onChange={(e) => {
            if (e.target.value === "__new__") {
              setAddingCategory(true);
              setNewCategoryDraft("");
              return;
            }
            updateField("category", e.target.value);
          }}
        >
          <option value="">Select category</option>
          {resolvedCategoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value="__new__">+ New category…</option>
        </select>
      )}

      <div className="dealer-m-newsale-field-label">Family Code</div>
      <input className="dealer-m-newsale-input" value={form.code} onChange={(e) => updateField("code", e.target.value)} />

      <div className="dealer-m-newsale-field-label">SKU</div>
      <input className="dealer-m-newsale-input" value={form.sku} onChange={(e) => updateField("sku", e.target.value)} />

      <div className="dealer-m-newsale-field-label">Description</div>
      <textarea
        className="dealer-m-newsale-textarea"
        rows={3}
        value={form.description}
        onChange={(e) => updateField("description", e.target.value)}
      />

      <div className="dealer-m-newsale-field-label" style={{ marginTop: 22 }}>
        Pack Size
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
        <input
          className="dealer-m-newsale-input"
          style={{ marginTop: 0 }}
          type="number"
          value={form.size}
          onChange={(e) => updateField("size", e.target.value)}
          placeholder="Size"
        />
        <select className="admin-m-select" style={{ marginTop: 0 }} value={form.unit} onChange={(e) => updateField("unit", e.target.value)}>
          {PACK_UNIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="dealer-m-newsale-field-label">Currency</div>
      <input className="dealer-m-newsale-input" value={form.currency} onChange={(e) => updateField("currency", e.target.value)} />

      <div className="dealer-m-newsale-field-label" style={{ marginTop: 22 }}>
        Pricing Model
      </div>
      <select className="admin-m-select" value={form.pricingModelKey} onChange={(e) => updateField("pricingModelKey", e.target.value)}>
        {PRICING_MODEL_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div className="dealer-m-newsale-field-label">Pricing Basis</div>
      <select className="admin-m-select" value={form.basis} onChange={(e) => updateField("basis", e.target.value)}>
        {BASIS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div className="dealer-m-newsale-products-head" style={{ marginTop: 18 }}>
        <div className="dealer-m-newsale-field-label" style={{ marginTop: 0 }}>
          Tier Ledger
        </div>
        <button type="button" className="dealer-m-newsale-add" onClick={addTier}>
          + Add tier
        </button>
      </div>
      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
        {form.tiers.map((tier, index) => (
          <div className="admin-m-tier-row" key={index}>
            <input
              className="admin-m-tier-input"
              value={normalizeTierInputValue(tier.min)}
              onChange={(e) => updateTier(index, "min", e.target.value)}
              placeholder="Min"
            />
            <input
              className="admin-m-tier-input"
              value={normalizeTierInputValue(tier.max)}
              onChange={(e) => updateTier(index, "max", e.target.value === "" ? null : e.target.value)}
              placeholder="Max"
            />
            <input
              className="admin-m-tier-input"
              value={normalizeTierInputValue(tier.pricePerPack)}
              onChange={(e) => updateTier(index, "pricePerPack", e.target.value)}
              placeholder="Price"
            />
            <button type="button" className="admin-m-tier-remove" disabled={form.tiers.length <= 1} onClick={() => removeTier(index)}>
              <DashboardIcon name="trash" size={13} strokeWidth={1.8} />
            </button>
          </div>
        ))}
      </div>

      <div className="dealer-m-newsale-field-label" style={{ marginTop: 22 }}>
        Orderable
      </div>
      <div style={{ marginTop: 8 }}>
        <SegmentedControl
          options={[
            { key: "true", label: "Orderable" },
            { key: "false", label: "Hidden" },
          ]}
          value={String(form.sellable)}
          onChange={(value) => updateField("sellable", value === "true")}
        />
      </div>

      {error ? <div className="dealer-m-newsale-error">{error}</div> : null}

      {isEdit ? (
        <div style={{ marginTop: 20, borderTop: "1px solid rgba(29,29,31,.08)", paddingTop: 16 }}>
          {form.isActive ? (
            <button type="button" className="dealer-m-newsale-ghost danger" onClick={handleDeactivate} disabled={saving}>
              Deactivate this product
            </button>
          ) : (
            <button type="button" className="dealer-m-newsale-ghost" onClick={handleRestore} disabled={saving}>
              Restore this product
            </button>
          )}
        </div>
      ) : null}
    </MobileSheet>
  );
}
