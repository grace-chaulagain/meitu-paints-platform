import { useState } from "react";
import { MobileSheet } from "../../dealer/mobile/MobileSheet.jsx";
import { StatusChip } from "../../dealer/mobile/StatusChip.jsx";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { useUploadAdminFamilyImageMutation, useDeleteAdminFamilyImageMutation } from "../../redux/api/meituApi.js";
import { toast } from "../../dealer/mobile/useToast.js";

function getPrimaryImage(images = []) {
  if (!Array.isArray(images) || !images.length) return null;
  return images.find((img) => img?.isPrimary) || images[0] || null;
}

function variantPriceLabel(variant) {
  const tiers = variant?.pricing?.tiers || [];
  if (!tiers.length) return "No price";
  const first = tiers[0];
  const price = first?.pricePerPack ?? first?.priceInclTax ?? first?.priceExclTax;
  if (typeof price !== "number") return "No price";
  const suffix = tiers.length > 1 ? ` · ${tiers.length} tiers` : "";
  return `${variant.currency || "NPR"} ${price.toLocaleString()}${suffix}`;
}

// Families have no edit/delete mutation in this codebase (seed/DB-managed
// only, per admin/catalog/AdminProductsPage.jsx - confirmed no create/edit
// endpoint exists) - this sheet only manages the family image and lists its
// variant products, matching that real constraint rather than offering a
// family-rename control that would silently no-op.
export function AdminFamilySheet({ open, entry, onClose, onAddVariant, onEditProduct }) {
  const [uploadFamilyImage, uploadState] = useUploadAdminFamilyImageMutation();
  const [deleteFamilyImage, deleteState] = useDeleteAdminFamilyImageMutation();
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const imageBusy = uploadState.isLoading || deleteState.isLoading;

  if (!entry) return <MobileSheet open={open} onClose={onClose} height="full" ariaLabel="Family" />;

  const primaryImage = getPrimaryImage(entry.familyImages);

  function handleUpload() {
    if (!entry.familyId) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        await uploadFamilyImage({ familyId: entry.familyId, file }).unwrap();
        toast("Family image updated");
      } catch {
        toast("Failed to upload family image");
      }
    };
    input.click();
  }

  async function handleRemove() {
    if (!entry.familyId || !primaryImage?.publicId) return;
    try {
      await deleteFamilyImage({ familyId: entry.familyId, publicId: primaryImage.publicId }).unwrap();
      setRemoveConfirm(false);
      toast("Family image removed");
    } catch {
      toast("Failed to remove family image");
    }
  }

  return (
    <MobileSheet open={open} onClose={onClose} height="full" ariaLabel={entry.name}>
      <div className="dealer-m-newsale-title">{entry.name}</div>
      {entry.isFallback ? (
        <div style={{ marginTop: 4 }}>
          <StatusChip tone="caution">No matching family record</StatusChip>
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: "flex", gap: 14, alignItems: "flex-start" }}>
        <span className="admin-m-image-well">
          {primaryImage?.url ? <img src={primaryImage.url} alt="" /> : <DashboardIcon name="package" size={28} strokeWidth={1.5} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="admin-m-kv-row" style={{ paddingTop: 0 }}>
            <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Category</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{entry.category || "Uncategorized"}</span>
          </div>
          <div className="admin-m-kv-row">
            <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>Code</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{entry.code}</span>
          </div>
          {entry.familyId ? (
            <div className="admin-m-image-actions" style={{ marginTop: 8 }}>
              <button type="button" className="admin-m-image-btn" onClick={handleUpload} disabled={imageBusy}>
                {primaryImage ? "Replace image" : "Add image"}
              </button>
              {primaryImage ? (
                <button type="button" className="admin-m-image-btn danger" onClick={() => setRemoveConfirm(true)} disabled={imageBusy}>
                  Remove
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {entry.description ? (
        <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.5, color: "var(--color-graphite, #707070)" }}>{entry.description}</div>
      ) : null}

      <div className="dealer-m-newsale-products-head" style={{ marginTop: 20 }}>
        <div className="dealer-m-newsale-field-label" style={{ marginTop: 0 }}>
          Variants · {entry.variants.length}
        </div>
        <button type="button" className="dealer-m-newsale-add" onClick={() => onAddVariant(entry)}>
          + Add variant
        </button>
      </div>

      <div className="admin-m-card-list" style={{ marginTop: 10 }}>
        {entry.variants.map((variant) => (
          <button
            key={variant._id}
            type="button"
            className="admin-m-card admin-m-feed-row"
            onClick={() => onEditProduct(variant)}
          >
            <span className="admin-m-feed-icon">
              <DashboardIcon name="package" size={16} strokeWidth={1.8} />
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="admin-m-feed-title">{variant.pack?.label || variant.sku}</span>
              <span className="admin-m-feed-detail">{variantPriceLabel(variant)}</span>
            </span>
            <StatusChip tone={variant.isActive === false ? "neutral" : "positive"}>
              {variant.isActive === false ? "Inactive" : "Active"}
            </StatusChip>
          </button>
        ))}
        {entry.variants.length === 0 ? (
          <div className="dealer-m-newsale-empty">No variants yet — add one to make this family orderable.</div>
        ) : null}
      </div>

      <MobileSheet
        open={removeConfirm}
        onClose={() => setRemoveConfirm(false)}
        ariaLabel="Remove family image"
        footer={
          <button type="button" className="dealer-m-primary-btn dealer-m-primary-btn-danger" onClick={handleRemove} disabled={imageBusy}>
            Remove Image
          </button>
        }
      >
        <div className="dealer-m-newsale-title">Remove this family image?</div>
        <div style={{ marginTop: 6, fontSize: 13, color: "var(--color-graphite, #707070)" }}>
          It will fall back to a variant image, if one exists, until you upload a new one.
        </div>
      </MobileSheet>
    </MobileSheet>
  );
}
