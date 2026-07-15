import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useGetAdminDispatcherQuery, useGetAdminDispatcherProductSummaryQuery } from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  Avatar,
  DashboardUIStyles,
  EmptyState,
  GhostButton,
  MetricTile,
  Pill,
  SearchField,
  SectionHeader,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { exportToCsv } from "../../../utils/exportToCsv.js";

function formatQty(value) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function categoryLabel(value) {
  if (!value) return "Uncategorized";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function balanceTone(balance) {
  if (balance <= 0) return "neutral";
  return "positive";
}

// A plain, minimal top-left back link.
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

// The small floating action popover shown above a clicked product row.
function ProductActionsPopover({ onSeePurchases, onSeeSales, onDismiss }) {
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={onDismiss} />
      <div
        style={{
          position: "absolute",
          bottom: "100%",
          left: 16,
          marginBottom: 8,
          zIndex: 50,
          background: "var(--color-surface, #fff)",
          borderRadius: 14,
          boxShadow: "0 12px 32px rgba(0,0,0,.16), 0 1px 0 rgba(0,0,0,.04)",
          border: "1px solid rgba(0,0,0,.06)",
          padding: 6,
          display: "flex",
          flexDirection: "column",
          minWidth: 180,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onSeePurchases}
          style={{
            display: "flex", alignItems: "center", gap: 10, border: "none", background: "transparent",
            padding: "9px 10px", borderRadius: 9, cursor: "pointer", textAlign: "left", fontSize: 13, fontWeight: 600,
            color: "var(--color-ink, #1d1d1f)",
          }}
          onMouseEnter={(event) => { event.currentTarget.style.background = "rgba(0,113,227,.08)"; }}
          onMouseLeave={(event) => { event.currentTarget.style.background = "transparent"; }}
        >
          <DashboardIcon name="truck" size={15} strokeWidth={1.8} style={{ color: "var(--color-azure, #0071e3)" }} />
          See Purchases
        </button>
        <button
          type="button"
          onClick={onSeeSales}
          style={{
            display: "flex", alignItems: "center", gap: 10, border: "none", background: "transparent",
            padding: "9px 10px", borderRadius: 9, cursor: "pointer", textAlign: "left", fontSize: 13, fontWeight: 600,
            color: "var(--color-ink, #1d1d1f)",
          }}
          onMouseEnter={(event) => { event.currentTarget.style.background = "rgba(0,113,227,.08)"; }}
          onMouseLeave={(event) => { event.currentTarget.style.background = "transparent"; }}
        >
          <DashboardIcon name="store" size={15} strokeWidth={1.8} style={{ color: "var(--color-azure, #0071e3)" }} />
          See Sales
        </button>
      </div>
    </>
  );
}

export default function AdminDispatcherSalesPurchasesPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const dispatcherId = useMemo(() => {
    const match = location.pathname.match(/^\/admin\/dashboard\/dispatchers\/([^/]+)\/sales-purchases$/);
    return match?.[1] || "";
  }, [location.pathname]);

  const [search, setSearch] = useState("");
  const [popoverProductId, setPopoverProductId] = useState("");

  const dispatcherQuery = useGetAdminDispatcherQuery(dispatcherId, { skip: !dispatcherId });
  const summaryQuery = useGetAdminDispatcherProductSummaryQuery(dispatcherId, { skip: !dispatcherId });

  const dispatcher = dispatcherQuery.data?.item || null;
  const items = useMemo(() => summaryQuery.data?.items || [], [summaryQuery.data]);

  const rows = useMemo(() => {
    return items
      .map((item) => ({
        productId: item.productId,
        name: item.name || "Unnamed product",
        sku: item.sku || "",
        category: item.category || "",
        pack: item.pack || {},
        purchase: Number(item.purchase || 0),
        sales: Number(item.sales || 0),
        balance: Number(item.balance || 0),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.sku.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const groupedRows = useMemo(() => {
    const groups = new Map();
    for (const row of filteredRows) {
      const key = row.category || "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    return Array.from(groups.entries())
      .sort((a, b) => categoryLabel(a[0]).localeCompare(categoryLabel(b[0])))
      .map(([category, categoryRows]) => ({ category, rows: categoryRows }));
  }, [filteredRows]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.purchase += row.purchase;
        acc.sales += row.sales;
        acc.balance += row.balance;
        return acc;
      },
      { purchase: 0, sales: 0, balance: 0 },
    );
  }, [rows]);

  const loadError = summaryQuery.error ? getQueryErrorMessage(summaryQuery.error, "Failed to load sales and purchases.") : "";

  function handleExport() {
    exportToCsv(`${dispatcher?.name || "dispatcher"}-sales-purchases`, [
      { key: "name", label: "Product Name" },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Category", value: (row) => categoryLabel(row.category) },
      { key: "purchase", label: "Purchase" },
      { key: "sales", label: "Sales" },
      { key: "balance", label: "Balance" },
    ], filteredRows);
  }

  function handleToggleProduct(productId) {
    setPopoverProductId((prev) => (String(prev) === String(productId) ? "" : productId));
  }

  function goToHistory(productId, mode) {
    setPopoverProductId("");
    navigate(`/admin/dashboard/dispatchers/${dispatcherId}/sales-purchases/${productId}/${mode}`);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <BackLink onClick={() => navigate(`/admin/dashboard/dispatchers/${dispatcherId}`)}>Back to Dispatcher Profile</BackLink>

      <Surface padding={20} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar label={dispatcher?.name || dispatcher?.companyName || "D"} size={44} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-ink, #1d1d1f)" }}>
                {dispatcher?.name || dispatcher?.companyName || "Dispatcher"} · Sales &amp; Purchases
              </div>
              <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                Lifetime purchase (from Factory) and sale (dispatched to dealers) totals, per product.
              </div>
            </div>
          </div>

          <GhostButton icon="download" onClick={handleExport} disabled={filteredRows.length === 0}>
            Export CSV
          </GhostButton>
        </div>
      </Surface>

      {loadError ? (
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
          {loadError}
        </div>
      ) : null}

      <Surface padding={26} className="dash-fade-up">
        <SectionHeader
          icon="chart"
          title="Product Summary"
          action={summaryQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
        />

        <div style={{ marginTop: 20, maxWidth: 360 }}>
          <SearchField value={search} onChange={setSearch} placeholder="Search product name, SKU, category…" />
        </div>

        <div style={{ marginTop: 12, fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          Click a product to see purchases or sales for it.
        </div>

        <div style={{ marginTop: 16 }}>
          {summaryQuery.isLoading && !summaryQuery.data ? (
            <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
          ) : filteredRows.length === 0 ? (
            <EmptyState
              icon="chart"
              title={rows.length === 0 ? "No activity yet" : "No matching products"}
              subtitle={rows.length === 0 ? "This dispatcher has no purchase or sale history yet." : "Try a different search term."}
            />
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {groupedRows.map((group) => (
                <div key={group.category}>
                  <div className="admin-sp-category-heading">
                    <span>{categoryLabel(group.category)}</span>
                    <span className="admin-sp-category-count">{group.rows.length}</span>
                  </div>
                  <div className="admin-sp-table" style={{ borderRadius: 16, border: "1px solid rgba(0,0,0,.06)", overflow: "visible" }}>
                    <div className="admin-sp-row admin-sp-head">
                      <span>Product</span>
                      <span style={{ textAlign: "right" }}>Purchase</span>
                      <span style={{ textAlign: "right" }}>Sales</span>
                      <span style={{ textAlign: "right" }}>Balance</span>
                    </div>
                    {group.rows.map((row) => (
                      <div key={row.productId} className="admin-sp-row-wrap" style={{ position: "relative" }}>
                        {String(row.productId) === String(popoverProductId) ? (
                          <ProductActionsPopover
                            onSeePurchases={() => goToHistory(row.productId, "purchases")}
                            onSeeSales={() => goToHistory(row.productId, "sales")}
                            onDismiss={() => setPopoverProductId("")}
                          />
                        ) : null}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => handleToggleProduct(row.productId)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleToggleProduct(row.productId);
                            }
                          }}
                          className={`admin-sp-row admin-sp-clickable-row ${String(row.productId) === String(popoverProductId) ? "is-selected" : ""}`}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 650, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {row.name}
                            </div>
                            <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                              {row.pack?.label ? `${row.pack.label} · ` : ""}{row.sku}
                            </div>
                          </div>
                          <span style={{ textAlign: "right", fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                            <DashboardIcon name="download" size={13} strokeWidth={1.8} style={{ color: "var(--color-graphite, #707070)" }} />
                            {formatQty(row.purchase)}
                          </span>
                          <span style={{ textAlign: "right", fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                            <DashboardIcon name="trend" size={13} strokeWidth={1.8} style={{ color: "var(--color-graphite, #707070)" }} />
                            {formatQty(row.sales)}
                          </span>
                          <span style={{ textAlign: "right" }}>
                            <Pill tone={balanceTone(row.balance)} size="small">{formatQty(row.balance)}</Pill>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {rows.length > 0 ? (
          <div style={{ marginTop: 28, paddingTop: 22, borderTop: "1px solid rgba(0,0,0,.06)" }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              Every product this dispatcher has ever received, dispatched, and currently holds.
            </div>

            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <MetricTile label="Products Tracked" value={rows.length} icon="package" />
              <MetricTile label="Total Purchased" value={formatQty(totals.purchase)} icon="download" />
              <MetricTile label="Total Dispatched" value={formatQty(totals.sales)} icon="trend" tone="accent" />
              <MetricTile label="Total Balance" value={formatQty(totals.balance)} icon="stock" tone="accent" />
            </div>
          </div>
        ) : null}
      </Surface>

      <style>{`
        .admin-sp-row{
          display:grid;
          grid-template-columns:minmax(0,1fr) 120px 120px 120px;
          gap:14px;
          align-items:center;
          padding:14px 18px;
        }
        .admin-sp-row-wrap > .admin-sp-row{
          border-top:1px solid rgba(0,0,0,.06);
        }
        .admin-sp-head{
          background:var(--color-fog, #f5f5f7);
          border-radius:15px 15px 0 0;
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.06em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
        }
        .admin-sp-clickable-row{
          cursor:pointer;
          transition:background-color .12s ease;
        }
        .admin-sp-clickable-row:hover{
          background:rgba(0,113,227,.05);
        }
        .admin-sp-clickable-row.is-selected{
          background:rgba(0,113,227,.09);
          box-shadow:inset 3px 0 0 var(--color-azure, #0071e3);
        }
        .admin-sp-category-heading{
          display:flex;
          align-items:center;
          gap:8px;
          margin-bottom:10px;
          font-size:12.5px;
          font-weight:700;
          letter-spacing:.02em;
          color:var(--color-ink, #1d1d1f);
        }
        .admin-sp-category-count{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-width:20px;
          height:20px;
          padding:0 6px;
          border-radius:999px;
          background:var(--color-fog, #f5f5f7);
          color:var(--color-graphite, #707070);
          font-size:11px;
          font-weight:700;
        }
        @media (max-width:720px){
          .admin-sp-row{
            grid-template-columns:minmax(0,1fr) 84px 84px 84px;
            gap:8px;
            padding:12px 14px;
          }
        }
      `}</style>
    </div>
  );
}
