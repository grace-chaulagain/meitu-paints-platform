import { useMemo, useState } from "react";
import {
  useGetDispatcherPricingQuery,
  useGetDispatcherPricingSummaryQuery,
  useUpdateDispatcherPricingMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  Avatar,
  EmptyState,
  GhostButton,
  ListRow,
  Pill,
  PrimaryButton,
  SearchField,
  SectionHeader,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import {
  clearDispatcherPricingClipboard,
  copyDispatcherPricingToClipboard,
  readDispatcherPricingClipboard,
} from "./dispatcherPricingClipboard.js";

function categoryLabel(value) {
  if (!value) return "Uncategorized";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function BackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 32,
        padding: "0 12px 0 8px",
        borderRadius: 999,
        border: "none",
        background: "var(--color-fog, #f5f5f7)",
        color: "var(--color-ink, #1d1d1f)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      <DashboardIcon name="chevron" size={13} strokeWidth={2.2} style={{ transform: "rotate(180deg)" }} />
      Dispatcher Price
    </button>
  );
}

function DispatcherPricingRow({ dispatcher, onOpen }) {
  const ratio = dispatcher.totalProducts > 0 ? dispatcher.pricedCount / dispatcher.totalProducts : 0;
  const tone = ratio === 0 ? "neutral" : ratio >= 1 ? "positive" : "caution";

  return (
    <ListRow onClick={() => onOpen(dispatcher._id)}>
      <Avatar label={dispatcher.companyName || dispatcher.name || "D"} size={36} />

      <div style={{ minWidth: 0, flex: 1, display: "grid", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>
            {dispatcher.companyName || dispatcher.name || "Unnamed dispatcher"}
          </span>
          <Pill tone={tone} size="small">
            {dispatcher.pricedCount} / {dispatcher.totalProducts} priced
          </Pill>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)", fontWeight: 500 }}>
          {dispatcher.name}{dispatcher.name && dispatcher.email ? " · " : ""}{dispatcher.email}
        </div>
      </div>

      <DashboardIcon name="chevron" size={14} strokeWidth={2} style={{ color: "var(--color-graphite, #707070)", flexShrink: 0 }} />
    </ListRow>
  );
}

function DispatcherPricingDirectory({ onOpen }) {
  const [search, setSearch] = useState("");
  const summaryQuery = useGetDispatcherPricingSummaryQuery();

  const dispatchers = useMemo(() => summaryQuery.data?.items || [], [summaryQuery.data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dispatchers;
    return dispatchers.filter((dispatcher) =>
      [dispatcher.name, dispatcher.companyName, dispatcher.email].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [dispatchers, search]);

  const loading = summaryQuery.isLoading && dispatchers.length === 0;
  const error = summaryQuery.error ? getQueryErrorMessage(summaryQuery.error, "Failed to load dispatchers.") : "";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          icon="truck"
          title="Dispatcher Price"
          subtitle="Each dispatcher has their own single flat price per product, independent of every other dispatcher."
          action={<GhostButton icon="refresh" onClick={() => summaryQuery.refetch()}>Refresh</GhostButton>}
        />

        <div style={{ marginTop: 16, maxWidth: 380 }}>
          <SearchField value={search} onChange={setSearch} placeholder="Search dispatcher or company…" />
        </div>

        {error ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>{error}</div>
        ) : null}
      </Surface>

      {loading ? (
        <Surface padding={18}>
          <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : filtered.length === 0 ? (
        <EmptyState icon="truck" title="No verified dispatchers found" subtitle="Verified dispatchers will appear here once approved." />
      ) : (
        <Surface padding={0} className="dash-fade-up">
          {filtered.map((dispatcher) => (
            <DispatcherPricingRow key={dispatcher._id} dispatcher={dispatcher} onOpen={onOpen} />
          ))}
        </Surface>
      )}
    </div>
  );
}

function fieldInputStyle() {
  return {
    width: "100%",
    height: 34,
    borderRadius: 9,
    border: "none",
    background: "var(--color-fog, #f5f5f7)",
    padding: "0 10px",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--color-ink, #1d1d1f)",
    outline: "none",
    textAlign: "right",
  };
}

function DispatcherPriceTablePage({ dispatcherId, onBack }) {
  const pricingQuery = useGetDispatcherPricingQuery(dispatcherId, { skip: !dispatcherId });
  const [updatePricing, { isLoading: saving }] = useUpdateDispatcherPricingMutation();

  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({});
  const [banner, setBanner] = useState(null); // { tone: "info"|"success"|"error", text }
  const [search, setSearch] = useState("");
  const [preImportSnapshot, setPreImportSnapshot] = useState(null); // items' price/netPrice right before the last import was applied
  const [undoing, setUndoing] = useState(false);

  const dispatcher = pricingQuery.data?.dispatcher || null;
  const items = useMemo(() => pricingQuery.data?.items || [], [pricingQuery.data]);
  const clipboard = readDispatcherPricingClipboard();
  const canImport = Boolean(clipboard && clipboard.sourceDispatcherId !== dispatcherId && clipboard.items.length);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => [item.name, item.sku, item.category].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)));
  }, [items, search]);

  const grouped = useMemo(() => {
    const groups = [];
    let current = null;
    for (const item of filteredItems) {
      if (!current || current.category !== item.category) {
        current = { category: item.category, items: [] };
        groups.push(current);
      }
      current.items.push(item);
    }
    return groups;
  }, [filteredItems]);

  const pricedCount = items.filter((item) => item.price !== null && item.price !== undefined).length;

  function startEdit() {
    setDraft({});
    setEditMode(true);
    setBanner(null);
    setPreImportSnapshot(null);
  }

  function cancelEdit() {
    setDraft({});
    setEditMode(false);
    setBanner(null);
    setPreImportSnapshot(null);
  }

  function updateDraftField(productId, field, value) {
    setDraft((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value },
    }));
  }

  function valueFor(item, field) {
    if (draft[item.productId]?.[field] !== undefined) return draft[item.productId][field];
    return item[field] ?? "";
  }

  async function handleSave() {
    const itemsById = new Map(items.map((item) => [item.productId, item]));
    const payloadItems = Object.entries(draft)
      .map(([productId, values]) => {
        const existing = itemsById.get(productId);
        const price = values.price !== undefined ? values.price : existing?.price;
        const netPrice = values.netPrice !== undefined ? values.netPrice : existing?.netPrice;
        return { productId, price, netPrice };
      })
      .filter((row) => row.price !== undefined && row.price !== null && row.price !== "");

    if (payloadItems.length === 0) {
      setBanner({ tone: "error", text: "No price changes to save." });
      return;
    }

    try {
      const result = await updatePricing({ dispatcherId, payload: { items: payloadItems } }).unwrap();
      const savedFromImport = Boolean(preImportSnapshot);
      setBanner({
        tone: "success",
        text: `Saved ${result.updated} price${result.updated === 1 ? "" : "s"}.${savedFromImport ? " Made a mistake? You can undo this import." : ""}`,
      });
      setDraft({});
      setEditMode(false);
      clearDispatcherPricingClipboard();
    } catch (err) {
      setBanner({ tone: "error", text: getQueryErrorMessage(err, "Failed to save pricing.") });
    }
  }

  async function handleUndoImport() {
    if (!preImportSnapshot) return;
    const payloadItems = preImportSnapshot.filter((row) => row.price !== null && row.price !== undefined);

    if (payloadItems.length === 0) {
      setPreImportSnapshot(null);
      setBanner(null);
      return;
    }

    setUndoing(true);
    try {
      await updatePricing({ dispatcherId, payload: { items: payloadItems } }).unwrap();
      setBanner({ tone: "success", text: "Import undone — previous prices restored." });
    } catch (err) {
      setBanner({ tone: "error", text: getQueryErrorMessage(err, "Failed to undo import.") });
    } finally {
      setUndoing(false);
      setPreImportSnapshot(null);
    }
  }

  function handleCopyTable() {
    copyDispatcherPricingToClipboard({ dispatcherId, dispatcherName: dispatcher?.companyName || dispatcher?.name, items });
    setBanner({ tone: "success", text: "Table copied. Open another dispatcher and use Import Table to apply it." });
  }

  function handleImportTable() {
    if (!clipboard) return;
    setPreImportSnapshot(items.map((item) => ({ productId: item.productId, price: item.price, netPrice: item.netPrice })));
    const nextDraft = {};
    for (const row of clipboard.items) {
      nextDraft[row.productId] = { price: row.price, netPrice: row.netPrice ?? 0 };
    }
    setDraft(nextDraft);
    setEditMode(true);
    setBanner({ tone: "info", text: `Imported ${clipboard.items.length} price${clipboard.items.length === 1 ? "" : "s"} from ${clipboard.sourceDispatcherName || "another dispatcher"}. Review and Save to apply.` });
  }

  if (pricingQuery.isLoading && !dispatcher) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Surface padding={20}>
          <div style={{ height: 60, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
        <Surface padding={18}>
          <div style={{ height: 320, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      </div>
    );
  }

  if (!dispatcher) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <div>
          <BackButton onClick={onBack} />
        </div>
        <EmptyState icon="truck" title="Dispatcher not found" />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <BackButton onClick={onBack} />
      </div>

      <Surface padding={20} className="dash-fade-up">
        <SectionHeader
          eyebrow="Dispatcher Price"
          icon="truck"
          title={dispatcher.companyName || dispatcher.name}
          subtitle={`${dispatcher.name}${dispatcher.email ? ` · ${dispatcher.email}` : ""} — ${pricedCount} of ${items.length} products priced.`}
          action={
            editMode ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <GhostButton onClick={cancelEdit} disabled={saving}>Cancel</GhostButton>
                <PrimaryButton icon="checkmark" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</PrimaryButton>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {preImportSnapshot ? (
                  <GhostButton icon="history" onClick={handleUndoImport} disabled={undoing}>
                    {undoing ? "Undoing…" : "Undo Import"}
                  </GhostButton>
                ) : null}
                <GhostButton icon="download" onClick={handleCopyTable}>Copy Table</GhostButton>
                <GhostButton icon="download" onClick={handleImportTable} disabled={!canImport}>Import Table</GhostButton>
                <PrimaryButton icon="edit" onClick={startEdit}>Edit Table</PrimaryButton>
              </div>
            )
          }
        />

        {banner ? (
          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 14px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              background: banner.tone === "error" ? "rgba(180,35,24,.08)" : banner.tone === "success" ? "rgba(22,163,74,.08)" : "rgba(0,113,227,.08)",
              color: banner.tone === "error" ? "#b42318" : banner.tone === "success" ? "#15803d" : "var(--color-azure, #0071e3)",
            }}
          >
            <DashboardIcon name={banner.tone === "error" ? "warning" : banner.tone === "success" ? "checkmark" : "download"} size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
            <span>{banner.text}</span>
          </div>
        ) : null}

        <div style={{ marginTop: 16, maxWidth: 380 }}>
          <SearchField value={search} onChange={setSearch} placeholder="Search product, code, SKU…" />
        </div>
      </Surface>

      <style>{`
        .dispatcher-price-row{ transition: background .15s ease; }
        .dispatcher-price-row:hover{ background: rgba(0,0,0,.02); }
      `}</style>

      <Surface padding={0} className="dash-fade-up">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) 90px 130px 130px",
            gap: 12,
            padding: "10px 16px",
            borderBottom: "1px solid rgba(0,0,0,.06)",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: ".06em",
            textTransform: "uppercase",
            color: "var(--color-graphite, #707070)",
          }}
        >
          <span>Product</span>
          <span>Size</span>
          <span style={{ textAlign: "right" }}>Price</span>
          <span style={{ textAlign: "right" }}>Net Price</span>
        </div>

        {grouped.length === 0 ? (
          <EmptyState icon="package" title="No products match this search" />
        ) : (
          grouped.map((group) => (
            <div key={group.category || "uncategorized"}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: ".04em",
                  textTransform: "uppercase",
                  color: "var(--color-graphite, #707070)",
                  background: "var(--color-fog, #f5f5f7)",
                }}
              >
                <DashboardIcon name="package" size={12} strokeWidth={2} />
                {categoryLabel(group.category)}
              </div>

              {group.items.map((item) => {
                const isPriced = item.price !== null && item.price !== undefined;
                return (
                  <div
                    key={item.productId}
                    className="dispatcher-price-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0,1fr) 90px 130px 130px",
                      gap: 12,
                      alignItems: "center",
                      padding: "9px 16px",
                      borderTop: "1px solid rgba(0,0,0,.05)",
                    }}
                  >
                    <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 9 }}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          background: "var(--color-fog, #f5f5f7)",
                          color: "var(--color-graphite, #707070)",
                          flexShrink: 0,
                        }}
                      >
                        <DashboardIcon name="package" size={13} strokeWidth={1.8} />
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.name}
                      </span>
                      {!isPriced ? <Pill tone="neutral" size="small">Unpriced</Pill> : null}
                    </div>

                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>
                      {item.packLabel || "—"}
                    </div>

                    {editMode ? (
                      <input
                        type="number"
                        min="0"
                        value={valueFor(item, "price")}
                        onChange={(e) => updateDraftField(item.productId, "price", e.target.value)}
                        placeholder="—"
                        style={fieldInputStyle()}
                      />
                    ) : (
                      <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
                        {isPriced ? `NPR ${Number(item.price).toLocaleString()}` : "—"}
                      </div>
                    )}

                    {editMode ? (
                      <input
                        type="number"
                        min="0"
                        value={valueFor(item, "netPrice")}
                        onChange={(e) => updateDraftField(item.productId, "netPrice", e.target.value)}
                        placeholder="—"
                        style={fieldInputStyle()}
                      />
                    ) : (
                      <div style={{ textAlign: "right", fontSize: 13, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                        {item.netPrice ? `NPR ${Number(item.netPrice).toLocaleString()}` : "—"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </Surface>
    </div>
  );
}

export default function DispatcherPricingWorkspace() {
  const [selectedDispatcherId, setSelectedDispatcherId] = useState(null);

  if (selectedDispatcherId) {
    return <DispatcherPriceTablePage dispatcherId={selectedDispatcherId} onBack={() => setSelectedDispatcherId(null)} />;
  }

  return <DispatcherPricingDirectory onOpen={setSelectedDispatcherId} />;
}
