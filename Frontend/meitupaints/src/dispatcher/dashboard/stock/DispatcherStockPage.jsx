import { useMemo, useState } from "react";
import { useGetMyDispatcherStockQuery } from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { DashboardUIStyles, EmptyState, ListRow, SearchField, SectionHeader, Surface } from "../../../components/dashboard/DashboardUI.jsx";

const COLUMNS = "minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) 100px 160px";

function StockHeaderRow() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: COLUMNS,
        gap: 12,
        padding: "10px 16px",
        borderBottom: "1px solid rgba(0,0,0,.06)",
      }}
    >
      {["Product", "SKU", "Category", "On Hand", "Last Updated"].map((label) => (
        <div key={label} style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
          {label}
        </div>
      ))}
    </div>
  );
}

function StockRow({ item }) {
  return (
    <ListRow>
      <div style={{ display: "grid", gridTemplateColumns: COLUMNS, gap: 12, alignItems: "center", flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.name || "Unnamed product"}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{item.sku || "—"}</div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{item.category || "—"}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{item.currentQuantity}</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          {item.lastUpdatedAt ? new Date(item.lastUpdatedAt).toLocaleString() : "—"}
        </div>
      </div>
    </ListRow>
  );
}

export default function DispatcherStockPage() {
  const [search, setSearch] = useState("");
  const stockQuery = useGetMyDispatcherStockQuery({ limit: 200 });

  const items = useMemo(() => stockQuery.data?.items || [], [stockQuery.data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.name, item.sku, item.category].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [items, search]);

  const loading = stockQuery.isLoading;
  const error = stockQuery.error ? getQueryErrorMessage(stockQuery.error, "Failed to load your stock.") : "";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          icon="stock"
          title="My Stock"
          subtitle="On-hand quantities at your regional warehouse — credited on Factory dispatch, debited when you dispatch a dealer order."
        />

        <div style={{ marginTop: 18, maxWidth: 380 }}>
          <SearchField value={search} onChange={setSearch} placeholder="Search product, SKU, or category…" />
        </div>

        {error ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        ) : null}
      </Surface>

      {loading ? (
        <Surface padding={18}>
          <div style={{ height: 200, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="stock"
          title={items.length === 0 ? "No stock on hand yet" : "No products match this search"}
          subtitle={items.length === 0 ? "Place an order from the Factory to get started." : ""}
        />
      ) : (
        <Surface padding={0} className="dash-fade-up">
          <StockHeaderRow />
          {filtered.map((item) => (
            <StockRow key={item.productId} item={item} />
          ))}
        </Surface>
      )}
    </div>
  );
}
