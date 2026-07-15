import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  useGetDealerInventoryItemQuery,
  useGetDealerInventoryMovementsQuery,
} from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import {
  Dropdown,
  EmptyState,
  GhostButton,
  Pill,
  SectionHeader,
  SegmentedControl,
  Surface,
} from "../../components/dashboard/DashboardUI.jsx";
import {
  categoryLabel,
  formatMoney,
  getPrimaryImage,
  movementDelta,
  movementLabel,
  movementReference,
  statusLabel,
  statusTone,
  timeAgo,
} from "./inventoryHelpers.js";

const PAGE_SIZE = 10;

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "history", label: "Stock History" },
];

const TYPE_OPTIONS = [
  { key: "ALL", label: "All Transactions" },
  { key: "PURCHASE", label: "Purchases" },
  { key: "SALE", label: "Sales" },
  { key: "RETURN", label: "Returns" },
  { key: "ADJUSTMENT", label: "Adjustments" },
  { key: "TRANSFER_IN", label: "Transfers in" },
  { key: "TRANSFER_OUT", label: "Transfers out" },
];

const RANGE_OPTIONS = [
  { key: "ALL", label: "All time" },
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
];

function rangeToDates(rangeKey) {
  if (rangeKey === "ALL") return { from: null, to: null };
  const days = Number(rangeKey);
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function exportMovementsCsv(items, productName) {
  const headers = ["Date", "Type", "Reference", "Quantity", "Unit Price", "Total", "Balance"];
  const rows = items.map((movement) => {
    const delta = movementDelta(movement);
    const unitPrice = movement.unitCost;
    return [
      new Date(movement.createdAt).toLocaleString("en-US"),
      movementLabel(movement.type),
      movementReference(movement),
      delta,
      unitPrice ?? "",
      unitPrice ? Math.abs(delta) * unitPrice : "",
      movement.newQuantity,
    ];
  });
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(productName || "product").toLowerCase().replaceAll(/\s+/g, "-")}-stock-history.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// Same plain chevron + text back-navigation convention already used on the
// admin dealer product-history/stock pages, rather than a boxed button.
function BackLink({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: "pointer",
        color: "var(--color-azure, #0071e3)",
        fontSize: 14.5,
        fontWeight: 600,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 6-6 6 6 6" />
      </svg>
      {children}
    </button>
  );
}

function InventoryStatCard({ icon, label, value, tone = "neutral" }) {
  return (
    <div className="dealer-invd-stat">
      <span className={`dealer-invd-stat-icon dealer-invd-stat-icon--${tone}`}>
        <DashboardIcon name={icon} size={18} strokeWidth={1.8} />
      </span>
      <div>
        <div className="dealer-invd-stat-label">{label}</div>
        <div className="dealer-invd-stat-value">{value}</div>
      </div>
    </div>
  );
}

function OverviewField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{value}</div>
    </div>
  );
}

function MovementDirectionIcon({ delta }) {
  const isIn = delta >= 0;
  return (
    <span
      style={{
        width: 26,
        height: 26,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: isIn ? "rgba(22,163,74,.1)" : "rgba(180,35,24,.1)",
        color: isIn ? "#15803d" : "#b42318",
        flexShrink: 0,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {isIn ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M19 12l-7 7-7-7" />}
      </svg>
    </span>
  );
}

function MovementsTable({ query, page, totalPages, onPageChange, emptySubtitle }) {
  const items = query.data?.items || [];
  const totalCount = Number(query.data?.pagination?.total || 0);
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(totalCount, page * PAGE_SIZE);
  const loadError = query.error ? getQueryErrorMessage(query.error, "Failed to load stock movements.") : "";

  if (query.isLoading && !query.data) {
    return (
      <Surface padding={18}>
        <div style={{ height: 200, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
      </Surface>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
        {loadError}
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState icon="history" title="No stock movements found" subtitle={emptySubtitle} />;
  }

  return (
    <>
      <Surface padding={0} className="dash-fade-up">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr style={{ background: "var(--color-fog, #f5f5f7)" }}>
                {["Date", "Type", "Reference", "Quantity", "Unit Price", "Total", "Balance"].map((head, index) => (
                  <th
                    key={head}
                    style={{
                      textAlign: index >= 3 ? "right" : "left",
                      padding: "10px 16px",
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: ".04em",
                      textTransform: "uppercase",
                      color: "var(--color-graphite, #707070)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((movement) => {
                const delta = movementDelta(movement);
                const lineTotal = movement.unitCost ? Math.abs(delta) * movement.unitCost : null;
                return (
                  <tr key={movement._id} style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                    <td style={{ padding: "10px 16px", fontSize: 12.5, color: "var(--color-graphite, #707070)", whiteSpace: "nowrap" }}>
                      {new Date(movement.createdAt).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <MovementDirectionIcon delta={delta} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)", whiteSpace: "nowrap" }}>
                          {movementLabel(movement.type)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{movementReference(movement)}</td>
                    <td
                      style={{
                        padding: "10px 16px",
                        textAlign: "right",
                        fontSize: 13,
                        fontWeight: 700,
                        color: delta >= 0 ? "#15803d" : "#b42318",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {delta >= 0 ? "+" : ""}
                      {delta}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, whiteSpace: "nowrap" }}>
                      {movement.unitCost ? formatMoney(movement.unitCost) : "—"}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, whiteSpace: "nowrap" }}>
                      {lineTotal ? formatMoney(lineTotal) : "—"}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 700 }}>{movement.newQuantity}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Surface>

      {totalPages > 1 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
            Showing {rangeStart}-{rangeEnd} of {totalCount} movements
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <GhostButton onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
              Previous
            </GhostButton>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              Page {page} of {totalPages}
            </span>
            <GhostButton onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
              Next
            </GhostButton>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function DealerInventoryDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);

  const [historyType, setHistoryType] = useState("ALL");
  const [historyRange, setHistoryRange] = useState("ALL");
  const [historyPage, setHistoryPage] = useState(1);

  const itemQuery = useGetDealerInventoryItemQuery(productId);
  const item = itemQuery.data;

  const { from, to } = useMemo(() => rangeToDates(historyRange), [historyRange]);

  const historyQuery = useGetDealerInventoryMovementsQuery({
    productId,
    type: historyType,
    from: from || undefined,
    to: to || undefined,
    page: historyPage,
    limit: PAGE_SIZE,
  });
  const historyTotalPages = Math.max(1, Number(historyQuery.data?.pagination?.pages || 1));

  function changeHistoryType(next) {
    setHistoryType(next);
    setHistoryPage(1);
  }

  function changeHistoryRange(next) {
    setHistoryRange(next);
    setHistoryPage(1);
  }

  const activeTabLabel = TABS.find((option) => option.key === tab)?.label || "Overview";

  if (itemQuery.isLoading && !item) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Surface padding={18}>
          <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      </div>
    );
  }

  if (itemQuery.error || !item) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <EmptyState
          icon="stock"
          title="Inventory item not found"
          subtitle={getQueryErrorMessage(itemQuery.error, "This product isn't in your inventory.")}
        />
        <div>
          <GhostButton onClick={() => navigate("/dealer/inventory")}>Back to Inventory</GhostButton>
        </div>
      </div>
    );
  }

  const image = getPrimaryImage(item.images);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <BackLink onClick={() => navigate("/dealer/inventory")}>Back to Inventory</BackLink>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>
          <Link to="/dealer/inventory" style={{ color: "inherit", textDecoration: "none" }}>
            Inventory
          </Link>
          <span>/</span>
          <span>Product Details</span>
          <span>/</span>
          <span style={{ color: "var(--color-ink, #1d1d1f)" }}>{activeTabLabel}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
          {tab === "history" ? (
            <GhostButton icon="download" onClick={() => exportMovementsCsv(historyQuery.data?.items || [], item.name)}>
              Export
            </GhostButton>
          ) : null}
          <GhostButton icon="moreHorizontal" onClick={() => setMenuOpen((open) => !open)} />
          {menuOpen ? (
            <div className="dealer-invd-menu">
              <button
                type="button"
                onClick={() => {
                  window.print();
                  setMenuOpen(false);
                }}
                className="dealer-invd-menu-item"
              >
                Print page
              </button>
              <button
                type="button"
                onClick={() => {
                  itemQuery.refetch();
                  historyQuery.refetch();
                  setMenuOpen(false);
                }}
                className="dealer-invd-menu-item"
              >
                Refresh data
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <Surface padding={22} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 18,
              background: "var(--color-fog, #f5f5f7)",
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {image?.url ? (
              <img src={image.url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "contain", mixBlendMode: "multiply" }} />
            ) : (
              <DashboardIcon name="package" size={32} strokeWidth={1.4} style={{ color: "rgba(0,0,0,.2)" }} />
            )}
          </div>
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-ink, #1d1d1f)" }}>{item.name}</div>
              <Pill tone={statusTone(item.status)} size="small">
                {statusLabel(item.status)}
              </Pill>
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: "var(--color-graphite, #707070)" }}>
              {[item.pack?.label, categoryLabel(item.category)].filter(Boolean).join(" · ") || "Product"}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <InventoryStatCard icon="stock" label="Current Stock" value={`${item.currentQuantity.toLocaleString()} Units`} />
          <InventoryStatCard icon="download" label="Total In All Time" value={`${item.totalReceivedQuantity.toLocaleString()} Units`} />
          <InventoryStatCard icon="trend" label="Total Sold All Time" value={`${item.totalSoldQuantity.toLocaleString()} Units`} />
          <InventoryStatCard
            icon="invoice"
            label="Average Price"
            value={item.lastKnownUnitCost ? formatMoney(item.lastKnownUnitCost) : "—"}
            tone="accent"
          />
        </div>

        <div style={{ marginTop: 20 }}>
          <SegmentedControl options={TABS} value={tab} onChange={setTab} />
        </div>
      </Surface>

      {tab === "overview" ? (
        <Surface padding={22} className="dash-fade-up">
          <SectionHeader icon="overview" title="Product details" size="small" />
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <OverviewField label="SKU" value={item.sku || "—"} />
            <OverviewField label="Product Code" value={item.code || "—"} />
            <OverviewField label="Category" value={categoryLabel(item.category) || "—"} />
            <OverviewField label="Pack" value={item.pack?.label || "—"} />
            <OverviewField label="Low Stock Threshold" value={item.lowStockThreshold ? `${item.lowStockThreshold} Units` : "—"} />
            <OverviewField label="Last Movement" value={timeAgo(item.lastMovementAt)} />
          </div>
        </Surface>
      ) : (
        <>
          <Surface padding={16} className="dash-fade-up">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Dropdown value={historyType} options={TYPE_OPTIONS} onChange={changeHistoryType} style={{ width: 190 }} />
              <Dropdown value={historyRange} options={RANGE_OPTIONS} onChange={changeHistoryRange} style={{ width: 160 }} />
              {historyQuery.isFetching ? (
                <Pill tone="accent" size="small">
                  Updating…
                </Pill>
              ) : null}
            </div>
          </Surface>
          <MovementsTable
            query={historyQuery}
            page={historyPage}
            totalPages={historyTotalPages}
            onPageChange={setHistoryPage}
            emptySubtitle="Nothing matches these filters yet."
          />
        </>
      )}

      <style>{`
        .dealer-invd-stat{
          display:flex;
          align-items:center;
          gap:12px;
          padding:14px 16px;
          border-radius:16px;
          border:1px solid rgba(29,29,31,.07);
          background:#fff;
        }
        .dealer-invd-stat-icon{
          width:42px;
          height:42px;
          border-radius:12px;
          display:grid;
          place-items:center;
          flex-shrink:0;
          background:var(--color-fog, #f5f5f7);
          color:var(--color-ink, #1d1d1f);
        }
        .dealer-invd-stat-icon--accent{
          background:rgba(0,113,227,.1);
          color:var(--color-azure, #0071e3);
        }
        .dealer-invd-stat-label{
          font-size:12px;
          font-weight:600;
          color:var(--color-graphite, #707070);
        }
        .dealer-invd-stat-value{
          margin-top:2px;
          font-size:19px;
          font-weight:800;
          letter-spacing:-.02em;
          color:var(--color-ink, #1d1d1f);
        }
        .dealer-invd-menu{
          position:absolute;
          top:44px;
          right:0;
          z-index:20;
          min-width:170px;
          border-radius:14px;
          border:1px solid rgba(29,29,31,.08);
          background:#fff;
          box-shadow:0 12px 28px rgba(15,23,42,.12);
          padding:6px;
        }
        .dealer-invd-menu-item{
          display:block;
          width:100%;
          text-align:left;
          padding:8px 10px;
          border-radius:9px;
          border:none;
          background:transparent;
          font-size:12.5px;
          font-weight:600;
          color:var(--color-ink, #1d1d1f);
          cursor:pointer;
        }
        .dealer-invd-menu-item:hover{
          background:var(--color-fog, #f5f5f7);
        }
      `}</style>
    </div>
  );
}
