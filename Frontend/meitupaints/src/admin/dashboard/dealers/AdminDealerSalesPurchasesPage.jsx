import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";

import { useGetAdminDealerQuery, useGetAdminDealerInventoryQuery } from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { exportToCsv } from "../../../utils/exportToCsv.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  Avatar,
  DashboardUIStyles,
  EmptyState,
  GhostButton,
  MetricTile,
  Pill,
  PrimaryButton,
  SearchField,
  SectionHeader,
  SegmentedControl,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { AppleDateField } from "../../../components/dashboard/ApplePickers.jsx";

function formatFilterDate(value) {
  if (!value) return "";
  // Interpreted as a plain calendar date (no time zone shift) since it's
  // always a "YYYY-MM-DD" key.
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dateFilterLabel(date) {
  return date ? formatFilterDate(date) : "All time";
}

// A compact icon-triggered popover for narrowing the summary down to a
// single calendar day - deliberately one date field rather than a from/to
// range, since the Product Summary table is meant to answer "what happened
// on this one day", not "across a window".
//
// Rendered through a portal into document.body (position computed from the
// trigger's own getBoundingClientRect, same pattern as DashboardUI.jsx's
// MetricInfoButton) rather than as a plain absolutely-positioned descendant.
// This page's cards use the shared "dash-fade-up" entrance animation, which
// leaves a non-"none" `transform` applied after it finishes (animation-fill-
// mode: both holding the final keyframe) - a transform other than none
// always creates a new CSS stacking context. Every "dash-fade-up" card is
// therefore its own stacking context, so a plain z-index on a popover
// nested inside the header card can never out-rank the Product Summary
// card that happens to come later in the DOM - it paints underneath it
// regardless of z-index. Escaping to document.body sidesteps the whole
// problem instead of trying to out-z-index a sibling stacking context.
function DateFilter({ value, onApply, onClear }) {
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(value);
  const [position, setPosition] = useState(null);
  const active = Boolean(value);
  const triggerRef = useRef(null);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = 220;
    const viewportPadding = 12;
    const left = Math.min(
      Math.max(viewportPadding, rect.right - width),
      window.innerWidth - width - viewportPadding,
    );
    const top = rect.bottom + 8;

    setPosition({ left, top, width });
  }, []);

  function closePopover() {
    setOpen(false);
    // Send focus back to the trigger so keyboard users don't lose their
    // place once the popover disappears (Escape, Apply, and Clear all
    // route through here for that reason).
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function openPopover() {
    setDraftDate(value);
    updatePosition();
    setOpen(true);
  }

  function apply() {
    onApply(draftDate);
    closePopover();
  }

  function clear() {
    setDraftDate("");
    onClear();
    closePopover();
  }

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        closePopover();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => (open ? closePopover() : openPopover())}
        aria-label="Filter by date"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`admin-sp-filter-btn ${active ? "is-active" : ""}`}
      >
        <DashboardIcon name="filter" size={15} strokeWidth={1.9} />
        {active ? <span className="admin-sp-filter-dot" aria-hidden="true" /> : null}
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 1400 }} onClick={closePopover} />
              <div
                className="admin-sp-filter-pop"
                role="dialog"
                aria-label="Filter by date"
                style={{ position: "fixed", top: position.top, left: position.left, width: position.width }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="admin-sp-filter-pop-title">
                  <DashboardIcon name="calendar" size={13} strokeWidth={1.9} />
                  Filter by date
                </div>

                <label className="admin-sp-filter-field">
                  <span>Date</span>
                  <AppleDateField value={draftDate || ""} onChange={setDraftDate} />
                </label>

                <div className="admin-sp-filter-pop-actions">
                  <GhostButton onClick={clear}>Clear</GhostButton>
                  <PrimaryButton
                    onClick={apply}
                    disabled={!draftDate}
                    style={{ height: 34, padding: "0 14px", fontSize: 12.5 }}
                  >
                    Apply
                  </PrimaryButton>
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

function formatQty(value) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function formatMoney(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
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

// The small floating action popover shown above a clicked product row -
// deliberately a lightweight hover-menu (no dark backdrop/blur like a real
// modal) since it's just a navigation shortcut, not content to review.
function ProductActionsPopover({ onSeeAll, onDismiss }) {
  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 40 }}
        onClick={onDismiss}
      />
      <div
        className="admin-sp-actions-pop"
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
          minWidth: 200,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onSeeAll}
          style={{
            display: "flex", alignItems: "center", gap: 10, border: "none", background: "transparent",
            padding: "9px 10px", borderRadius: 9, cursor: "pointer", textAlign: "left", fontSize: 13, fontWeight: 600,
            color: "var(--color-ink, #1d1d1f)",
          }}
          onMouseEnter={(event) => { event.currentTarget.style.background = "rgba(0,113,227,.08)"; }}
          onMouseLeave={(event) => { event.currentTarget.style.background = "transparent"; }}
        >
          <DashboardIcon name="overview" size={15} strokeWidth={1.8} style={{ color: "var(--color-azure, #0071e3)" }} />
          See Sales and Purchases
        </button>
      </div>
    </>
  );
}

export default function AdminDealerSalesPurchasesPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const dealerId = useMemo(() => {
    const match = location.pathname.match(/^\/admin\/dashboard\/dealers\/([^/]+)\/sales-purchases$/);
    return match?.[1] || "";
  }, [location.pathname]);

  const [view, setView] = useState(location.state?.initialView === "stock" ? "stock" : "sales");
  const [search, setSearch] = useState("");
  const [popoverProductId, setPopoverProductId] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const dealerQuery = useGetAdminDealerQuery(dealerId, { skip: !dealerId });
  const inventoryQuery = useGetAdminDealerInventoryQuery(
    {
      dealerId,
      // A single selected day is sent as its own from/to bounds (start of
      // day to end of day) so the Product Summary reflects just that one
      // day's activity, not a running range.
      from: filterDate || undefined,
      to: filterDate ? `${filterDate}T23:59:59.999` : undefined,
    },
    { skip: !dealerId },
  );

  const dealer = dealerQuery.data?.item || null;
  const items = useMemo(() => inventoryQuery.data?.items || [], [inventoryQuery.data]);

  const rows = useMemo(() => {
    return items
      .map((item) => {
        const purchase = Number(item.totalReceivedQuantity || 0);
        const sales = Number(item.totalSoldQuantity || 0);
        return {
          productId: item.productId,
          name: item.name || "Unnamed product",
          sku: item.sku || "",
          category: item.category || "",
          pack: item.pack || {},
          purchase,
          sales,
          balance: purchase - sales,
        };
      })
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

  // On-hand quantity/value/status reflect live stock and aren't affected by
  // the Sales & Purchases date filter (only totalReceivedQuantity/
  // totalSoldQuantity change with that filter - see the backend's
  // listDealerStock), so the Stock view reuses this same already-fetched
  // "items" list rather than issuing a second query.
  const groupedStock = useMemo(() => {
    const groups = new Map();
    for (const item of items) {
      const key = item.category || "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    return Array.from(groups.entries())
      .sort((a, b) => categoryLabel(a[0]).localeCompare(categoryLabel(b[0])))
      .map(([category, categoryItems]) => ({ category, items: categoryItems }));
  }, [items]);

  const stockSummary = inventoryQuery.data?.summary || {
    totalValue: 0,
    totalUnits: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalProducts: 0,
  };

  const loadError = inventoryQuery.error ? getQueryErrorMessage(inventoryQuery.error, "Failed to load sales and purchases.") : "";
  const hasDateFilter = Boolean(filterDate);
  const dateLabel = dateFilterLabel(filterDate);

  function handleExport() {
    const filenameSuffix = hasDateFilter ? `_${filterDate}` : "";
    exportToCsv(`${dealer?.companyName || "dealer"}-sales-purchases${filenameSuffix}`, [
      { key: "name", label: "Product Name" },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Category", value: (row) => categoryLabel(row.category) },
      { key: "purchase", label: "Purchase" },
      { key: "sales", label: "Sales" },
      { key: "balance", label: "Balance" },
      { key: "date", label: "Date", value: () => dateLabel },
    ], filteredRows);
  }

  function handleExportStock() {
    exportToCsv(`${dealer?.companyName || "dealer"}-stock`, [
      { key: "name", label: "Product Name" },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Category", value: (item) => categoryLabel(item.category) },
      { key: "currentQuantity", label: "On Hand" },
      { key: "inventoryValue", label: "Value" },
      { key: "status", label: "Status", value: (item) => stockLabel(item.status) },
    ], items);
  }

  function handleToggleProduct(productId) {
    setPopoverProductId((prev) => (String(prev) === String(productId) ? "" : productId));
  }

  function goToHistory(productId, mode) {
    setPopoverProductId("");
    navigate(`/admin/dashboard/dealers/${dealerId}/sales-purchases/${productId}/${mode}`);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <BackLink onClick={() => navigate(`/admin/dashboard/dealers/${dealerId}`)}>Back to Dealer Profile</BackLink>

      <Surface padding={20} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar label={dealer?.companyName || dealer?.contactName || "D"} size={44} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-ink, #1d1d1f)" }}>
                {dealer?.companyName || "Dealer"} · {view === "stock" ? "Stock" : "Sales & Purchases"}
              </div>
              <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {view === "stock" ? (
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                    Live on-hand stock, per product.
                  </span>
                ) : (
                  <>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                      {hasDateFilter ? "Purchase and sale totals on" : "Lifetime purchase and sale totals, per product."}
                    </span>
                    {hasDateFilter ? (
                      <Pill tone="accent" size="small">{dateLabel}</Pill>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {view === "sales" ? (
              <DateFilter
                value={filterDate}
                onApply={setFilterDate}
                onClear={() => setFilterDate("")}
              />
            ) : null}
            <GhostButton
              icon="download"
              onClick={view === "stock" ? handleExportStock : handleExport}
              disabled={view === "stock" ? items.length === 0 : filteredRows.length === 0}
            >
              Export CSV
            </GhostButton>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <SegmentedControl
            options={[
              { key: "sales", label: "Sales & Purchases" },
              { key: "stock", label: "Stock" },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
      </Surface>

      {loadError ? (
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
          {loadError}
        </div>
      ) : null}

      {view === "sales" ? (
      <Surface padding={26} className="dash-fade-up">
        <SectionHeader
          icon="chart"
          title="Product Summary"
          action={inventoryQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
        />

        <div style={{ marginTop: 20, maxWidth: 360 }}>
          <SearchField value={search} onChange={setSearch} placeholder="Search product name, SKU, category…" />
        </div>

        <div style={{ marginTop: 12, fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          Click a product to see purchases or sales for it.
        </div>

        <div style={{ marginTop: 16 }}>
          {inventoryQuery.isLoading && !inventoryQuery.data ? (
            <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
          ) : filteredRows.length === 0 ? (
            <EmptyState
              icon="chart"
              title={rows.length === 0 ? "No purchases yet" : "No matching products"}
              subtitle={rows.length === 0 ? "This dealer hasn't received any delivered orders yet." : "Try a different search term."}
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
                            onSeeAll={() => goToHistory(row.productId, "all")}
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
              {hasDateFilter
                ? `Every product with activity on ${dateLabel}.`
                : "Every product this dealer has ever ordered, sold, and currently holds."}
            </div>

            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <MetricTile label="Products Tracked" value={rows.length} icon="package" />
              <MetricTile label="Total Purchased" value={formatQty(totals.purchase)} icon="download" />
              <MetricTile label="Total Sold" value={formatQty(totals.sales)} icon="trend" tone="accent" />
              <MetricTile label="Total Balance" value={formatQty(totals.balance)} icon="stock" tone="accent" />
            </div>
          </div>
        ) : null}
      </Surface>
      ) : (
      <Surface padding={26} className="dash-fade-up">
        <SectionHeader
          icon="stock"
          title="Stock"
          action={inventoryQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
        />

        <div style={{ marginTop: 12, fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
          Current on-hand quantity and value for every product this dealer holds.
        </div>

        <div style={{ marginTop: 16 }}>
          {inventoryQuery.isLoading && !inventoryQuery.data ? (
            <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
          ) : items.length === 0 ? (
            <EmptyState icon="stock" title="No stock yet" subtitle="This dealer hasn't received any delivered orders yet." />
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {groupedStock.map((group) => (
                <div key={group.category}>
                  <div className="admin-sp-category-heading">
                    <span>{categoryLabel(group.category)}</span>
                    <span className="admin-sp-category-count">{group.items.length}</span>
                  </div>
                  <div style={{ borderRadius: 16, border: "1px solid rgba(0,0,0,.06)", overflow: "hidden" }}>
                    <div className="admin-sp-stock-row admin-sp-head">
                      <span>Product</span>
                      <span>Pack</span>
                      <span style={{ textAlign: "right" }}>On Hand</span>
                      <span style={{ textAlign: "right" }}>Value</span>
                      <span>Status</span>
                    </div>
                    {group.items.map((item) => (
                      <div key={item.productId} className="admin-sp-stock-row" style={{ borderTop: "1px solid rgba(0,0,0,.06)" }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 650, color: "var(--color-ink, #1d1d1f)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.name}
                          </span>
                          <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{item.sku}</span>
                        </span>
                        <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>{item.pack?.label || "—"}</span>
                        <span style={{ textAlign: "right", fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>
                          {formatQty(item.currentQuantity)}
                        </span>
                        <span style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>
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

        {items.length > 0 ? (
          <div style={{ marginTop: 28, paddingTop: 22, borderTop: "1px solid rgba(0,0,0,.06)" }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              Live snapshot of every product this dealer currently holds.
            </div>

            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <MetricTile label="Products Tracked" value={stockSummary.totalProducts} icon="package" />
              <MetricTile label="Total Units On Hand" value={formatQty(stockSummary.totalUnits)} icon="stock" />
              <MetricTile label="Total Value" value={formatMoney(stockSummary.totalValue)} icon="chart" tone="accent" />
              <MetricTile label="Low Stock" value={stockSummary.lowStockCount} icon="warning" tone={stockSummary.lowStockCount > 0 ? "accent" : "neutral"} />
              <MetricTile label="Out of Stock" value={stockSummary.outOfStockCount} icon="reject" tone={stockSummary.outOfStockCount > 0 ? "accent" : "neutral"} />
            </div>
          </div>
        ) : null}
      </Surface>
      )}

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
        .admin-sp-stock-row{
          display:grid;
          grid-template-columns:minmax(0,1fr) 90px 90px 110px 110px;
          gap:12px;
          align-items:center;
          padding:12px 16px;
        }
        @media (max-width:720px){
          .admin-sp-row{
            grid-template-columns:minmax(0,1fr) 84px 84px 84px;
            gap:8px;
            padding:12px 14px;
          }
          .admin-sp-stock-row{
            grid-template-columns:minmax(0,1fr) 66px 84px 74px;
            gap:8px;
            padding:10px 14px;
          }
          .admin-sp-stock-row > span:nth-child(2){
            display:none;
          }
        }

        .admin-sp-filter-btn{
          position:relative;
          width:38px;
          height:38px;
          border-radius:999px;
          border:1px solid rgba(29,29,31,.1);
          background:rgba(255,255,255,.88);
          color:var(--color-ink, #1d1d1f);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
          transition:transform .14s var(--ease-out, ease), background .14s ease, border-color .14s ease;
        }
        .admin-sp-filter-btn:hover{
          background:rgba(29,29,31,.05);
        }
        .admin-sp-filter-btn:active{
          transform:scale(.93);
        }
        .admin-sp-filter-btn.is-active{
          border-color:rgba(0,113,227,.32);
          background:rgba(0,113,227,.08);
          color:var(--color-azure, #0071e3);
        }
        .admin-sp-filter-dot{
          position:absolute;
          top:6px;
          right:6px;
          width:7px;
          height:7px;
          border-radius:999px;
          background:var(--color-azure, #0071e3);
          border:1.5px solid #fff;
        }

        .admin-sp-actions-pop{
          transform-origin:bottom left;
          animation:adminSpActionsPopIn .16s var(--ease-out, cubic-bezier(.23,1,.32,1)) both;
        }
        @keyframes adminSpActionsPopIn{
          from{ opacity:0; transform:scale(.95); }
          to{ opacity:1; transform:scale(1); }
        }
        @media (prefers-reduced-motion: reduce){
          .admin-sp-actions-pop{ animation:none!important; }
        }
        .admin-sp-filter-pop{
          /* position/top/left/width are set inline (computed from the
             trigger's getBoundingClientRect via a portal - see
             DateRangeFilter) since this renders into document.body. */
          z-index:1401;
          padding:14px;
          border-radius:16px;
          background:#fff;
          border:1px solid rgba(0,0,0,.06);
          box-shadow:0 12px 32px rgba(0,0,0,.16), 0 1px 0 rgba(0,0,0,.04);
          transform-origin:top right;
          animation:adminSpFilterPopIn .15s var(--ease-out, cubic-bezier(.23,1,.32,1)) both;
        }
        @keyframes adminSpFilterPopIn{
          from{ opacity:0; transform:scale(.96); }
          to{ opacity:1; transform:scale(1); }
        }
        @media (prefers-reduced-motion: reduce){
          .admin-sp-filter-pop{ animation:none!important; }
        }
        .admin-sp-filter-pop-title{
          display:flex;
          align-items:center;
          gap:6px;
          font-size:12px;
          font-weight:700;
          color:var(--color-ink, #1d1d1f);
          margin-bottom:10px;
        }
        .admin-sp-filter-field{
          display:grid;
          gap:4px;
          margin-bottom:10px;
        }
        .admin-sp-filter-field span{
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.03em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
        }
        .admin-sp-filter-pop-actions{
          display:flex;
          align-items:center;
          justify-content:flex-end;
          gap:8px;
          margin-top:2px;
        }

        @media (prefers-reduced-motion: reduce){
          .admin-sp-filter-btn{ transition:none!important; }
        }
      `}</style>
    </div>
  );
}
