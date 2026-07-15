import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  useGetAdminDispatcherQuery,
  useGetAdminDispatcherStockQuery,
  useGetAdminDispatcherFulfilledOrdersQuery,
  useGetAdminDispatcherDealerStatsQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  Avatar,
  DashboardUIStyles,
  EmptyState,
  Pill,
  SectionHeader,
  SearchField,
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

function categoryLabel(value) {
  if (!value) return "Uncategorized";
  return String(value)
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function stockStatus(item) {
  const qty = Number(item.currentQuantity || 0);
  const threshold = Number(item.lowStockThreshold || 0);
  if (qty <= 0) return "OUT_OF_STOCK";
  if (threshold > 0 && qty <= threshold) return "LOW_STOCK";
  return "IN_STOCK";
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

function orderStatusTone(status) {
  if (status === "DISPATCHED" || status === "COMPLETED") return "positive";
  if (status === "REJECTED" || status === "CANCELLED") return "critical";
  return "accent";
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

function OrderPreviewModal({ order, onClose }) {
  if (!order) return null;
  const dealerName = order.dealerId?.companyName || order.dealerSnapshot?.companyName || "Dealer";

  return (
    <ModalShell onClose={onClose}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <SectionHeader eyebrow={order.orderNumber} icon="orders" title={dealerName} />
        <CloseButton onClick={onClose} />
      </div>

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <Pill tone={orderStatusTone(order.status)} size="small">{order.status}</Pill>
        <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{formatDate(order.createdAt)}</span>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 6 }}>
        {(order.items || []).map((item, index) => (
          <div key={`${item.productId || index}`} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderRadius: 10, background: "var(--color-fog, #f5f5f7)", fontSize: 12.5 }}>
            <span>{item.name}{item.packLabel ? ` (${item.packLabel})` : ""} × {item.quantity}</span>
            <span style={{ fontWeight: 700 }}>{formatMoney(item.lineTotal)}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "rgba(0,113,227,.06)" }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Total</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-azure, #0071e3)" }}>{formatMoney(order.totals?.total)}</span>
      </div>
    </ModalShell>
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

// A compact icon+label tab strip for the page's three top-level sections.
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

const PAGE_SIZE = 10;

export default function AdminDispatcherStockPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const dispatcherId = useMemo(() => {
    const match = location.pathname.match(/^\/admin\/dashboard\/dispatchers\/([^/]+)\/stock$/);
    return match?.[1] || "";
  }, [location.pathname]);

  const [tab, setTab] = useState("stock");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [salesFilterOpen, setSalesFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dealerNameFilter, setDealerNameFilter] = useState("");
  const [salesPage, setSalesPage] = useState(1);
  const [dealerSearch, setDealerSearch] = useState("");

  const dispatcherQuery = useGetAdminDispatcherQuery(dispatcherId, { skip: !dispatcherId });
  const stockQuery = useGetAdminDispatcherStockQuery(dispatcherId, { skip: !dispatcherId });
  const salesQuery = useGetAdminDispatcherFulfilledOrdersQuery(
    { dispatcherId, limit: 200 },
    { skip: !dispatcherId },
  );
  const dealerStatsQuery = useGetAdminDispatcherDealerStatsQuery(dispatcherId, { skip: !dispatcherId });

  const dispatcher = dispatcherQuery.data?.item || null;
  const stockItems = useMemo(() => stockQuery.data?.items || [], [stockQuery.data]);
  const salesItems = useMemo(() => salesQuery.data?.items || [], [salesQuery.data]);
  const dealers = useMemo(() => dealerStatsQuery.data?.items || [], [dealerStatsQuery.data]);

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

  const hasActiveSalesFilters = Boolean(dateFrom || dateTo || dealerNameFilter.trim());

  function clearSalesFilters() {
    setDateFrom("");
    setDateTo("");
    setDealerNameFilter("");
  }

  const filteredSales = useMemo(() => {
    let items = salesItems;
    if (dealerNameFilter.trim()) {
      const q = dealerNameFilter.trim().toLowerCase();
      items = items.filter((order) => {
        const name = order.dealerId?.companyName || order.dealerSnapshot?.companyName || "";
        return name.toLowerCase().includes(q);
      });
    }
    if (dateFrom) {
      const fromTime = new Date(dateFrom).getTime();
      items = items.filter((order) => !order.createdAt || new Date(order.createdAt).getTime() >= fromTime);
    }
    if (dateTo) {
      const toTime = new Date(dateTo).getTime() + 86399999;
      items = items.filter((order) => !order.createdAt || new Date(order.createdAt).getTime() <= toTime);
    }
    return items;
  }, [salesItems, dealerNameFilter, dateFrom, dateTo]);

  const salesTotalPages = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE));
  const clampedSalesPage = Math.min(Math.max(1, salesPage), salesTotalPages);
  const pagedSales = useMemo(
    () => filteredSales.slice((clampedSalesPage - 1) * PAGE_SIZE, clampedSalesPage * PAGE_SIZE),
    [filteredSales, clampedSalesPage],
  );

  const filteredDealers = useMemo(() => {
    const q = dealerSearch.trim().toLowerCase();
    const pool = q
      ? dealers.filter((dealer) => (dealer.companyName || "").toLowerCase().includes(q) || (dealer.contactName || "").toLowerCase().includes(q))
      : dealers;
    return pool.slice().sort((a, b) => Number(b.totalSpend || 0) - Number(a.totalSpend || 0));
  }, [dealers, dealerSearch]);

  const topDealer = useMemo(() => {
    return dealers
      .filter((dealer) => Number(dealer.totalSpend || 0) > 0)
      .sort((a, b) => Number(b.totalSpend || 0) - Number(a.totalSpend || 0))[0] || null;
  }, [dealers]);

  const stockError = stockQuery.error ? getQueryErrorMessage(stockQuery.error, "Failed to load stock.") : "";
  const salesError = salesQuery.error ? getQueryErrorMessage(salesQuery.error, "Failed to load sales.") : "";
  const dealersError = dealerStatsQuery.error ? getQueryErrorMessage(dealerStatsQuery.error, "Failed to load dealers.") : "";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <BackLink onClick={() => navigate(-1)}>Back</BackLink>

      <Surface padding={20} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar label={dispatcher?.name || dispatcher?.companyName || "D"} size={44} />
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-ink, #1d1d1f)" }}>
              {dispatcher?.name || dispatcher?.companyName || "Dispatcher"} · Stock &amp; Sales
            </div>
            <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              {dispatcher?.companyName || dispatcher?.email || ""}
            </div>
          </div>
        </div>
      </Surface>

      <div className="dash-fade-up">
        <PageTabs
          options={[
            { key: "stock", label: "Stock", icon: "stock" },
            { key: "sales", label: "Sales", icon: "orders" },
            { key: "dealers", label: "Dealers", icon: "store" },
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
                <EmptyState icon="stock" title="No stock yet" subtitle="This dispatcher hasn't received any replenishment orders yet." />
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
                        {group.items.map((item) => {
                          const status = stockStatus(item);
                          return (
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
                                <Pill tone={stockTone(status)} size="small">{stockLabel(status)}</Pill>
                              </span>
                            </div>
                          );
                        })}
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
          {salesError ? (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
              {salesError}
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
                  <span style={filterFieldLabelStyle}>Dealer name</span>
                  <input
                    type="text"
                    placeholder="Search by dealer…"
                    value={dealerNameFilter}
                    onChange={(event) => setDealerNameFilter(event.target.value)}
                    style={textInputStyle}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              {salesQuery.isLoading && !salesQuery.data ? (
                <div style={{ height: 180, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
              ) : filteredSales.length === 0 ? (
                <EmptyState icon="orders" title="No sales yet" subtitle="This dispatcher hasn't dispatched any orders to its dealers yet." />
              ) : (
                <>
                  <div style={{ borderRadius: 14, border: "1px solid rgba(0,0,0,.06)", overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "130px minmax(0,1fr) 100px 100px 90px", gap: 12, padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,.06)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
                      <span>Order #</span>
                      <span>Dealer</span>
                      <span>Date</span>
                      <span style={{ textAlign: "right" }}>Total</span>
                      <span>Status</span>
                    </div>
                    {pagedSales.map((order) => (
                      <div
                        key={order._id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedOrder(order)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedOrder(order);
                          }
                        }}
                        className="dash-list-row dash-selectable-row"
                        style={{ display: "grid", gridTemplateColumns: "130px minmax(0,1fr) 100px 100px 90px", gap: 12, alignItems: "center", padding: "10px 16px", cursor: "pointer" }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-graphite, #707070)" }}>{order.orderNumber}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {order.dealerId?.companyName || order.dealerSnapshot?.companyName || "—"}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>{formatDate(order.createdAt)}</span>
                        <span style={{ textAlign: "right", fontSize: 13, fontWeight: 700 }}>{formatMoney(order.totals?.total)}</span>
                        <span><Pill tone={orderStatusTone(order.status)} size="small">{order.status}</Pill></span>
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
      ) : (
        <>
          {dealersError ? (
            <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
              {dealersError}
            </div>
          ) : null}

          <Surface padding={22} className="dash-fade-up">
            <SectionHeader
              icon="store"
              title="Dealers"
              action={dealerStatsQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
            />

            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <div style={{ borderRadius: 14, border: "1px solid rgba(0,0,0,.06)", padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
                  <DashboardIcon name="trend" size={13} strokeWidth={2} />
                  Top Dealer
                </div>
                {topDealer ? (
                  <>
                    <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {topDealer.companyName}
                    </div>
                    <div style={{ marginTop: 3, fontSize: 13.5, fontWeight: 700, color: "var(--color-azure, #0071e3)" }}>
                      {formatMoney(topDealer.totalSpend)}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>
                      {topDealer.totalOrders || 0} orders fulfilled
                    </div>
                  </>
                ) : (
                  <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>No sales yet</div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 20, maxWidth: 360 }}>
              <SearchField value={dealerSearch} onChange={setDealerSearch} placeholder="Search dealer name…" />
            </div>

            <div style={{ marginTop: 16 }}>
              {dealerStatsQuery.isLoading && !dealerStatsQuery.data ? (
                <div style={{ height: 180, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
              ) : filteredDealers.length === 0 ? (
                <EmptyState icon="store" title="No dealers assigned" subtitle="This dispatcher has no dealers routed to it yet." />
              ) : (
                <div style={{ borderRadius: 14, border: "1px solid rgba(0,0,0,.06)", overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 100px 110px 110px 110px", gap: 12, padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,.06)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
                    <span>Dealer</span>
                    <span>Status</span>
                    <span style={{ textAlign: "right" }}>Lifetime Spend</span>
                    <span style={{ textAlign: "right" }}>Orders</span>
                    <span>Last Order</span>
                  </div>
                  {filteredDealers.map((dealer) => (
                    <div
                      key={dealer._id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/admin/dashboard/dealers/${dealer._id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate(`/admin/dashboard/dealers/${dealer._id}`);
                        }
                      }}
                      className="dash-list-row dash-selectable-row"
                      style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 100px 110px 110px 110px", gap: 12, alignItems: "center", padding: "10px 16px", cursor: "pointer" }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 650, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {dealer.companyName}
                        </span>
                        <span style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)" }}>{dealer.contactName}</span>
                      </span>
                      <span><Pill tone={dealer.status === "VERIFIED" ? "positive" : "critical"} size="small">{dealer.status === "VERIFIED" ? "Active" : dealer.status}</Pill></span>
                      <span style={{ textAlign: "right", fontSize: 13, fontWeight: 700 }}>{formatMoney(dealer.totalSpend)}</span>
                      <span style={{ textAlign: "right", fontSize: 13, fontWeight: 600 }}>{dealer.totalOrders || 0}</span>
                      <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>{formatDate(dealer.lastOrderAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Surface>
        </>
      )}

      <OrderPreviewModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />

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
