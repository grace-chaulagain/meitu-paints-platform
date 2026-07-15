import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  useGetAdminDealerQuery,
  useGetAdminDealerInventoryQuery,
  useGetAdminSalesQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  Avatar,
  DashboardUIStyles,
  EmptyState,
  Pill,
  SectionHeader,
  SegmentedControl,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { AppleDateField } from "../../../components/dashboard/ApplePickers.jsx";

function formatMoney(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function stockTone(status) {
  if (status === "OUT_OF_STOCK") return "critical";
  if (status === "LOW_STOCK") return "caution";
  return "positive";
}

function stockLabel(status) {
  if (status === "OUT_OF_STOCK") return "Out of stock";
  if (status === "LOW_STOCK") return "Low stock";
  return "In stock";
}

function categoryLabel(value) {
  if (!value) return "Uncategorized";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const textInputStyle = {
  height: 30,
  width: "100%",
  border: "none",
  borderRadius: 8,
  background: "var(--color-fog, #f5f5f7)",
  padding: "0 10px",
  fontSize: 12.5,
  fontWeight: 500,
  color: "var(--color-ink, #1d1d1f)",
  outline: "none",
};

const filterFieldLabelStyle = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: ".05em",
  textTransform: "uppercase",
  color: "var(--color-graphite, #707070)",
};

// A compact icon+label tab strip for the page's three top-level sections -
// distinct from SegmentedControl (used below for the lighter-weight
// category filter chips) so the primary navigation reads as more prominent.
function PageTabs({ options, value, onChange }) {
  return (
    <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 14, background: "rgba(232,232,237,.6)" }}>
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            className="dash-page-tab"
            onClick={() => onChange(option.key)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 34,
              padding: "0 14px",
              borderRadius: 10,
              border: "none",
              background: active ? "#fff" : "transparent",
              color: active ? "var(--color-ink, #1d1d1f)" : "var(--color-graphite, #707070)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,.08)" : "none",
              transition: "background .16s ease, color .16s ease",
            }}
          >
            <DashboardIcon name={option.icon} size={15} strokeWidth={2} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function FilterIconButton({ active, open, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Filters"
      aria-pressed={open}
      style={{
        position: "relative",
        width: 34,
        height: 34,
        borderRadius: 10,
        border: "none",
        background: open || active ? "rgba(0,113,227,.1)" : "var(--color-fog, #f5f5f7)",
        color: open || active ? "var(--color-azure, #0071e3)" : "var(--color-graphite, #707070)",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        transition: "background .18s ease, color .18s ease",
      }}
    >
      <DashboardIcon name="filter" size={15} strokeWidth={2} />
      {active ? (
        <span style={{ position: "absolute", top: 5, right: 5, width: 6, height: 6, borderRadius: 999, background: "var(--color-azure, #0071e3)" }} />
      ) : null}
    </button>
  );
}

function ClearFilterButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Clear filters"
      title="Clear filters"
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        border: "none",
        background: "var(--color-fog, #f5f5f7)",
        color: "var(--color-graphite, #707070)",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
      }}
    >
      <DashboardIcon name="close" size={13} strokeWidth={2} />
    </button>
  );
}

function PagerButton({ disabled, onClick, children }) {
  return (
    <button
      type="button"
      className="dash-pager-btn"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 30,
        height: 30,
        borderRadius: 999,
        border: "none",
        background: "var(--color-fog, #f5f5f7)",
        color: "var(--color-ink, #1d1d1f)",
        display: "grid",
        placeItems: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

// A plain, minimal top-left back link - Apple's own back-navigation
// convention (chevron + text, no button chrome) rather than a boxed
// button competing with the page's real actions.
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

function CloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      style={{ width: 32, height: 32, borderRadius: 999, border: "none", background: "var(--color-fog, #f5f5f7)", color: "var(--color-graphite, #707070)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
    >
      <DashboardIcon name="close" size={14} strokeWidth={2} />
    </button>
  );
}

function ModalShell({ children, onClose, width = 560 }) {
  return (
    <div
      className="dash-modal-backdrop-in"
      style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,.4)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "grid", placeItems: "center", padding: 28 }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Surface className="dash-modal-surface-in" style={{ width: `min(${width}px, 100%)`, maxHeight: "88vh", overflow: "auto" }} padding={22} onClick={(event) => event.stopPropagation()}>
        {children}
      </Surface>
    </div>
  );
}

function SaleDetailModal({ sale, onClose }) {
  if (!sale) return null;

  return (
    <ModalShell onClose={onClose}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <SectionHeader eyebrow={sale.saleNumber} icon="orders" title={sale.billId ? `Bill ${sale.billId}` : "Sale"} />
        <CloseButton onClick={onClose} />
      </div>

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <Pill tone={sale.status === "VOIDED" ? "critical" : "positive"} size="small">{sale.status}</Pill>
        <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{formatDate(sale.saleDate)}</span>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 6 }}>
        {(sale.items || []).map((item) => (
          <div key={item.productId} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 10, background: "var(--color-fog, #f5f5f7)", fontSize: 12.5 }}>
            <span>{item.name} × {item.quantity}</span>
            <span style={{ fontWeight: 700 }}>{formatMoney(item.lineTotal)}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "rgba(0,113,227,.06)" }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-azure, #0071e3)" }}>{formatMoney(sale.totals?.total)}</span>
      </div>

      {sale.status === "VOIDED" ? (
        <div style={{ marginTop: 14, fontSize: 12.5, color: "#b42318" }}>Voided: {sale.voidReason}</div>
      ) : null}
    </ModalShell>
  );
}

export default function AdminDealerStockPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const dealerId = useMemo(() => {
    const match = location.pathname.match(
      /^\/admin\/dashboard\/(?:dealers|sales)\/([^/]+)\/stock$/,
    );
    return match?.[1] || "";
  }, [location.pathname]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [tab, setTab] = useState("stock");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [billIdFilter, setBillIdFilter] = useState("");
  const [salesFilterOpen, setSalesFilterOpen] = useState(false);
  const [salesPage, setSalesPage] = useState(1);
  const SALES_PAGE_SIZE = 10;

  const dealerQuery = useGetAdminDealerQuery(dealerId, { skip: !dealerId });
  const stockQuery = useGetAdminDealerInventoryQuery(dealerId, { skip: !dealerId });
  const salesQuery = useGetAdminSalesQuery({ dealerId, limit: 200 }, { skip: !dealerId });

  const dealer = dealerQuery.data?.item || null;
  const stockItems = useMemo(() => stockQuery.data?.items || [], [stockQuery.data]);
  const salesItems = useMemo(() => salesQuery.data?.items || [], [salesQuery.data]);

  const hasActiveSalesFilters = Boolean(dateFrom || dateTo || billIdFilter.trim());

  function clearSalesFilters() {
    setDateFrom("");
    setDateTo("");
    setBillIdFilter("");
  }

  const filteredSales = useMemo(() => {
    let items = salesItems;
    if (billIdFilter.trim()) {
      const q = billIdFilter.trim().toLowerCase();
      items = items.filter((sale) => (sale.billId || "").toLowerCase().includes(q));
    }
    if (dateFrom) {
      const fromTime = new Date(dateFrom).getTime();
      items = items.filter((sale) => !sale.saleDate || new Date(sale.saleDate).getTime() >= fromTime);
    }
    if (dateTo) {
      const toTime = new Date(dateTo).getTime() + 86399999;
      items = items.filter((sale) => !sale.saleDate || new Date(sale.saleDate).getTime() <= toTime);
    }
    return items;
  }, [salesItems, billIdFilter, dateFrom, dateTo]);

  const salesTotalPages = Math.max(1, Math.ceil(filteredSales.length / SALES_PAGE_SIZE));
  // Clamped rather than reset via effect: if a filter change shrinks the
  // page count, this just displays the last valid page for the current
  // salesPage value instead of needing a setState-in-effect round trip.
  const clampedSalesPage = Math.min(Math.max(1, salesPage), salesTotalPages);
  const pagedSales = useMemo(
    () => filteredSales.slice((clampedSalesPage - 1) * SALES_PAGE_SIZE, clampedSalesPage * SALES_PAGE_SIZE),
    [filteredSales, clampedSalesPage],
  );

  const groupedStock = useMemo(() => {
    const groups = new Map();
    for (const item of stockItems) {
      const key = item.category || "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    return Array.from(groups.entries())
      .sort((a, b) => categoryLabel(a[0]).localeCompare(categoryLabel(b[0])))
      .map(([category, items]) => ({ category, items }));
  }, [stockItems]);

  const stockError = stockQuery.error ? getQueryErrorMessage(stockQuery.error, "Failed to load stock.") : "";
  const loadError = salesQuery.error ? getQueryErrorMessage(salesQuery.error, "Failed to load sales.") : "";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <BackLink onClick={() => navigate(-1)}>Back</BackLink>

      <Surface padding={20} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar label={dealer?.companyName || dealer?.contactName || "D"} size={44} />
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-ink, #1d1d1f)" }}>
              {dealer?.companyName || "Dealer"} · Stock &amp; Sales
            </div>
            <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              {dealer?.contactName || dealer?.email || ""}
            </div>
          </div>
        </div>
      </Surface>

      <div className="dash-fade-up">
        <PageTabs
          options={[
            { key: "stock", label: "Stock", icon: "stock" },
            { key: "sales", label: "Sales", icon: "orders" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === "stock" ? (
        <>
          {stockError ? (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
              {stockError}
            </div>
          ) : null}

          <Surface padding={22} className="dash-fade-up">
            <SectionHeader
              icon="stock"
              title="Stock"
              action={stockQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
            />

            <div style={{ marginTop: 18 }}>
              {stockQuery.isLoading && !stockQuery.data ? (
                <div style={{ height: 180, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
              ) : stockItems.length === 0 ? (
                <EmptyState icon="stock" title="No stock yet" subtitle="This dealer hasn't received any delivered orders yet." />
              ) : (
                <div style={{ display: "grid", gap: 20 }}>
                  {groupedStock.map((group) => (
                    <div key={group.category}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 12.5, fontWeight: 700, letterSpacing: ".02em", color: "var(--color-ink, #1d1d1f)" }}>
                        <span>{categoryLabel(group.category)}</span>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: "var(--color-fog, #f5f5f7)", color: "var(--color-graphite, #707070)", fontSize: 11, fontWeight: 700 }}>
                          {group.items.length}
                        </span>
                      </div>
                      <div style={{ borderRadius: 14, border: "1px solid rgba(0,0,0,.06)", overflow: "hidden" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 90px 110px 110px", gap: 12, padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,.06)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
                          <span>Product</span>
                          <span>Pack</span>
                          <span style={{ textAlign: "right" }}>On Hand</span>
                          <span style={{ textAlign: "right" }}>Value</span>
                          <span>Status</span>
                        </div>
                        {group.items.map((item) => (
                          <div
                            key={item.productId}
                            className="dash-list-row"
                            style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 90px 110px 110px", gap: 12, alignItems: "center", padding: "10px 16px" }}
                          >
                            <span style={{ minWidth: 0 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {item.name}
                              </span>
                              <span style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>{item.sku}</span>
                            </span>
                            <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>{item.pack?.label || "—"}</span>
                            <span style={{ textAlign: "right", fontSize: 13, fontWeight: 700 }}>
                              {Number(item.currentQuantity || 0).toLocaleString()}
                            </span>
                            <span style={{ textAlign: "right", fontSize: 13, fontWeight: 600 }}>
                              {item.inventoryValue ? formatMoney(item.inventoryValue) : "—"}
                            </span>
                            <span>
                              <Pill tone={stockTone(item.status)} size="small">{stockLabel(item.status)}</Pill>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Surface>
        </>
      ) : tab === "sales" ? (
        <>
          {loadError ? (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
              {loadError}
            </div>
          ) : null}

          <Surface padding={22} className="dash-fade-up">
            <SectionHeader
              icon="orders"
              title="Sales"
              action={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {salesQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
                  <FilterIconButton
                    active={hasActiveSalesFilters}
                    open={salesFilterOpen}
                    onClick={() => setSalesFilterOpen((open) => !open)}
                  />
                  {hasActiveSalesFilters ? (
                    <ClearFilterButton
                      onClick={() => {
                        clearSalesFilters();
                        setSalesFilterOpen(false);
                      }}
                    />
                  ) : null}
                </div>
              }
            />

            <div className={`dash-filter-panel ${salesFilterOpen ? "open" : ""}`}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <span style={filterFieldLabelStyle}>Date range</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <DashboardIcon name="calendar" size={13} strokeWidth={2} style={{ color: "var(--color-graphite, #707070)" }} />
                    <AppleDateField value={dateFrom} onChange={setDateFrom} />
                    <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>–</span>
                    <AppleDateField value={dateTo} onChange={setDateTo} />
                  </div>
                </div>

                <div style={{ display: "grid", gap: 6, flex: "1 1 200px", minWidth: 180 }}>
                  <span style={filterFieldLabelStyle}>Bill ID</span>
                  <input
                    type="text"
                    placeholder="Search by Bill ID…"
                    value={billIdFilter}
                    onChange={(event) => setBillIdFilter(event.target.value)}
                    style={textInputStyle}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              {salesQuery.isLoading && !salesQuery.data ? (
                <div style={{ height: 180, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
              ) : filteredSales.length === 0 ? (
                <EmptyState
                  icon="orders"
                  title="No sales yet"
                  subtitle="This dealer hasn't recorded any sales yet."
                />
              ) : (
                <>
                  <div style={{ borderRadius: 14, border: "1px solid rgba(0,0,0,.06)", overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr) 100px 100px 90px", gap: 12, padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,.06)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
                      <span>Sale #</span>
                      <span>Bill ID</span>
                      <span>Date</span>
                      <span style={{ textAlign: "right" }}>Total</span>
                      <span>Status</span>
                    </div>
                    {pagedSales.map((sale) => (
                      <div
                        key={sale._id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedSale(sale)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedSale(sale);
                          }
                        }}
                        className="dash-list-row dash-selectable-row"
                        style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr) 100px 100px 90px", gap: 12, alignItems: "center", padding: "10px 16px", cursor: "pointer" }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-graphite, #707070)" }}>{sale.saleNumber}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {sale.billId || "—"}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>{formatDate(sale.saleDate)}</span>
                        <span style={{ textAlign: "right", fontSize: 13, fontWeight: 700 }}>{formatMoney(sale.totals?.total)}</span>
                        <span><Pill tone={sale.status === "VOIDED" ? "critical" : "positive"} size="small">{sale.status}</Pill></span>
                      </div>
                    ))}
                  </div>

                  {salesTotalPages > 1 ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 16 }}>
                      <PagerButton disabled={clampedSalesPage <= 1} onClick={() => setSalesPage(clampedSalesPage - 1)}>
                        <DashboardIcon name="chevron" size={14} strokeWidth={2} style={{ transform: "rotate(180deg)" }} />
                      </PagerButton>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>
                        Page {clampedSalesPage} of {salesTotalPages}
                      </span>
                      <PagerButton disabled={clampedSalesPage >= salesTotalPages} onClick={() => setSalesPage(clampedSalesPage + 1)}>
                        <DashboardIcon name="chevron" size={14} strokeWidth={2} />
                      </PagerButton>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </Surface>
        </>
      ) : null}

      {selectedSale ? <SaleDetailModal sale={selectedSale} onClose={() => setSelectedSale(null)} /> : null}

      <style>{`
        .dash-filter-panel{
          max-height:0;
          opacity:0;
          overflow:hidden;
          margin-top:0;
          transition:max-height .32s cubic-bezier(.4,0,.2,1), opacity .22s ease, margin-top .32s cubic-bezier(.4,0,.2,1);
        }
        .dash-filter-panel.open{
          max-height:220px;
          opacity:1;
          margin-top:16px;
        }
      `}</style>
    </div>
  );
}
