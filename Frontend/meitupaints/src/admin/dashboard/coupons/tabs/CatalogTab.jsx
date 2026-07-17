import { useMemo, useState } from "react";

import {
  useCreatePointsCatalogProductMutation,
  useDeletePointsCatalogProductMutation,
  useGetAdminPointsCatalogProductsQuery,
  useUpdatePointsCatalogProductMutation,
} from "../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../redux/api/selectors.js";
import { DashboardIcon } from "../../../../components/dashboard/DashboardIcons.jsx";
import {
  DataTable,
  GhostButton,
  Pagination,
  Pill,
  PrimaryButton,
  SearchField,
  SectionHeader,
  Surface,
  ToggleSwitch,
} from "../../../../components/dashboard/DashboardUI.jsx";
import { AppleDropdown } from "../../../../components/dashboard/ApplePickers.jsx";
import ConfirmActionModal from "../../../catalog/components/ConfirmActionModal.jsx";
import { CATALOG_CATEGORY_ALL_OPTION, couponTypeLabel, PAGE_SIZE, PRICING_MODE_OPTIONS, TYPE_OPTIONS } from "../couponFormatting.js";

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

function catalogPricingSummary(product) {
  if (product.pricingMode === "FLAT") return `${product.flatPoints || 0} pts`;
  const sizes = product.sizes || [];
  if (!sizes.length) return "No sizes";
  const points = sizes.map((entry) => Number(entry.points)).filter((value) => Number.isFinite(value));
  const min = points.length ? Math.min(...points) : 0;
  const max = points.length ? Math.max(...points) : 0;
  return min === max ? `${sizes.length} size · ${min} pts` : `${sizes.length} sizes · ${min}-${max} pts`;
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

export default function CatalogTab({ onToast }) {
  const [category, setCategory] = useState("ALL");
  const [q, setQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [page, setPage] = useState(1);
  const [formProduct, setFormProduct] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionError, setActionError] = useState("");

  const catalogQuery = useGetAdminPointsCatalogProductsQuery({ q, category, page, limit: PAGE_SIZE });
  const [createProduct, { isLoading: creating }] = useCreatePointsCatalogProductMutation();
  const [updateProduct, { isLoading: updating }] = useUpdatePointsCatalogProductMutation();
  const [deleteProduct, { isLoading: deleting }] = useDeletePointsCatalogProductMutation();

  const items = useMemo(() => catalogQuery.data?.items || [], [catalogQuery.data]);
  const pagination = catalogQuery.data?.pagination || { page: 1, pages: 1, total: 0 };
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

  function changeCategory(next) {
    setCategory(next);
    setPage(1);
  }

  function submitSearch() {
    setQ(draftQ.trim());
    setPage(1);
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

  const columns = useMemo(
    () => [
      {
        key: "product",
        header: "Product",
        width: "26%",
        render: (product) => (
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 30,
                height: 30,
                flexShrink: 0,
                borderRadius: 9,
                display: "grid",
                placeItems: "center",
                background: product.couponType === "GOLDEN" ? "rgba(182,68,0,.1)" : "var(--color-fog,#f5f5f7)",
                color: product.couponType === "GOLDEN" ? "var(--color-caution,#b64400)" : "var(--color-graphite,#707070)",
              }}
            >
              <DashboardIcon name="package" size={14} strokeWidth={1.8} />
            </span>
            <span style={{ fontWeight: 700 }}>{product.name}</span>
          </span>
        ),
      },
      { key: "category", header: "Category", render: (product) => <span style={{ color: "var(--color-graphite,#707070)" }}>{product.category || "—"}</span> },
      {
        key: "type",
        header: "Type",
        render: (product) => <Pill tone={product.couponType === "GOLDEN" ? "caution" : "positive"} size="small">{couponTypeLabel(product.couponType)}</Pill>,
      },
      { key: "pricing", header: "Pricing", render: (product) => catalogPricingSummary(product) },
      {
        key: "status",
        header: "Status",
        render: (product) => <Pill tone={product.isActive !== false ? "positive" : "neutral"} size="small">{product.isActive !== false ? "Active" : "Inactive"}</Pill>,
      },
      {
        key: "actions",
        header: "",
        align: "right",
        width: 90,
        render: (product) => (
          <span style={{ display: "inline-flex", gap: 6 }} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="coupon-catalog-icon-btn" onClick={() => openEditForm(product)} aria-label={`Edit ${product.name}`}>
              <DashboardIcon name="edit" size={14} strokeWidth={1.9} />
            </button>
            <button type="button" className="coupon-catalog-icon-btn is-danger" onClick={() => setDeleteTarget(product)} aria-label={`Delete ${product.name}`}>
              <DashboardIcon name="trash" size={14} strokeWidth={1.9} />
            </button>
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={16}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <AppleDropdown value={category} options={categoryOptions} onChange={changeCategory} style={{ width: 200 }} />
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
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={items}
            getRowKey={(product) => product._id}
            loading={catalogQuery.isLoading && !catalogQuery.data}
            emptyState={{ icon: "package", title: "No catalog products found", subtitle: "Add the first product to make it available in Generate." }}
            minWidth={760}
          />
          <Pagination page={pagination.page} totalPages={pagination.pages} totalCount={pagination.total} itemLabel="products" onChange={setPage} />
        </>
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

      <style>{`
        .coupon-catalog-icon-btn{
          width:30px;
          height:30px;
          border:none;
          border-radius:9px;
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
        .coupon-catalog-icon-btn:focus-visible{
          outline:none;
          box-shadow:0 0 0 3px rgba(0,113,227,.18);
        }
        @media (prefers-reduced-motion: reduce){
          .coupon-catalog-icon-btn{ transition:none!important; }
        }
      `}</style>
    </div>
  );
}
