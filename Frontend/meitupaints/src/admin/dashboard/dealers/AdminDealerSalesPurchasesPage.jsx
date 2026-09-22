import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  useGetAdminDealerQuery,
  useGetAdminDealerInventoryQuery,
  useGetAdminSalesQuery,
  useGetAdminOrdersQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { exportToCsv } from "../../../utils/exportToCsv.js";
import { formatTime, normalizeStatus, orderStatusMeta } from "../../../dealer/orderDetailLogic.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  Avatar,
  DashboardUIStyles,
  DataTable,
  GhostButton,
  Pagination,
  Pill,
  SearchField,
  SectionHeader,
  SegmentedControl,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { useCountUp } from "../../../dealer/mobile/useCountUp.js";
import {
  categoryLabel,
  dateRangeLabel,
  dateRangeParams,
  formatDayHeading,
  formatFilterDate,
  formatMoney,
  formatQty,
  isoDateKey,
  stockLabel,
  stockTone,
} from "../salesPurchases/salesPurchasesFormat.js";
import {
  DateRangeControl,
  GroupHeaderRow,
  HistoryOrderPreviewModal,
  HistorySaleDetailModal,
  SalesPurchasesBackButton,
  SalesPurchasesStyles,
} from "../salesPurchases/SalesPurchasesKit.jsx";

// One row per real Sale/Order document, not per InventoryMovement line item -
// a 3-product order is one order event, not three rows.
function buildHistoryEvents(sales, orders) {
  const saleEvents = sales.map((sale) => ({ type: "sale", key: `sale-${sale._id}`, date: new Date(sale.saleDate), sale }));
  const orderEvents = orders.map((order) => ({ type: "order", key: `order-${order._id}`, date: new Date(order.createdAt), order }));
  return [...saleEvents, ...orderEvents]
    .filter((event) => !Number.isNaN(event.date.getTime()))
    .sort((a, b) => b.date - a.date);
}

const HISTORY_PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDealerSalesPurchasesPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const dealerId = useMemo(() => {
    const match = location.pathname.match(/^\/admin\/dashboard\/dealers\/([^/]+)\/sales-purchases$/);
    return match?.[1] || "";
  }, [location.pathname]);

  const [view, setView] = useState(location.state?.initialView === "stock" ? "stock" : "history");
  const [search, setSearch] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [previewOrder, setPreviewOrder] = useState(null);
  const [previewSale, setPreviewSale] = useState(null);

  const dealerQuery = useGetAdminDealerQuery(dealerId, { skip: !dealerId });
  const inventoryQuery = useGetAdminDealerInventoryQuery(
    {
      dealerId,
      // The admin's own day bounds - see dateRangeParams.
      ...dateRangeParams(filterFrom, filterTo),
    },
    { skip: !dealerId },
  );
  // Fetched only once the tab is actually opened - the same date range
  // filter as the By Product tab applies here too. This reads the actual
  // Sale and Order collections directly (not the per-product movement
  // ledger), and is scoped to real purchases only - status:"ALL" so
  // delivered/completed history isn't hidden behind the default
  // submitted-only view, excludeOrigins:"SCHEME" so free grants don't show
  // up as paid purchases.
  const salesForHistoryQuery = useGetAdminSalesQuery(
    {
      dealerId,
      ...dateRangeParams(filterFrom, filterTo),
      limit: 100,
    },
    { skip: !dealerId || view !== "history" },
  );
  const ordersForHistoryQuery = useGetAdminOrdersQuery(
    {
      dealerId,
      status: "ALL",
      excludeOrigins: "SCHEME",
      ...dateRangeParams(filterFrom, filterTo),
      limit: 100,
    },
    { skip: !dealerId || view !== "history" },
  );

  const dealer = dealerQuery.data?.item || null;
  const items = useMemo(() => inventoryQuery.data?.items || [], [inventoryQuery.data]);

  const rows = useMemo(() => {
    return items.map((item) => {
      const purchase = Number(item.totalReceivedQuantity || 0);
      const scheme = Number(item.totalSchemeQuantity || 0);
      const sales = Number(item.totalSoldQuantity || 0);
      const unitCost = Number(item.lastKnownUnitCost || 0);
      return {
        productId: item.productId,
        name: item.name || "Unnamed product",
        sku: item.sku || "",
        category: item.category || "",
        pack: item.pack || {},
        purchase,
        scheme,
        sales,
        // Scheme goods enter stock the same as any other order (they're
        // genuinely sellable), so Balance has to include them to keep
        // meaning "what this dealer actually has" - matching the Stock
        // tab's live currentQuantity rather than just Purchase minus Sales.
        // Purchase itself stays purchase-only on purpose (a commercial
        // figure a free grant shouldn't inflate).
        balance: purchase + scheme - sales,
        unitCost,
        purchaseValue: purchase * unitCost,
      };
    });
  }, [items]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) => row.name.toLowerCase().includes(q) || row.sku.toLowerCase().includes(q) || row.category.toLowerCase().includes(q),
    );
  }, [rows, search]);

  // Sorted category-then-name so a category's rows are contiguous - required
  // for the group-header-on-first-row-of-group pattern below.
  const sortedProductRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const catCompare = categoryLabel(a.category).localeCompare(categoryLabel(b.category));
      return catCompare !== 0 ? catCompare : a.name.localeCompare(b.name);
    });
  }, [filteredRows]);

  const productGroupHeaderByFirstId = useMemo(() => {
    const counts = new Map();
    for (const row of sortedProductRows) counts.set(row.category, (counts.get(row.category) || 0) + 1);
    const map = new Map();
    let lastCategory = null;
    for (const row of sortedProductRows) {
      if (row.category !== lastCategory) {
        map.set(row.productId, { label: categoryLabel(row.category), count: counts.get(row.category) });
        lastCategory = row.category;
      }
    }
    return map;
  }, [sortedProductRows]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.purchase += row.purchase;
        acc.scheme += row.scheme;
        acc.sales += row.sales;
        acc.balance += row.balance;
        acc.purchaseValue += row.purchaseValue;
        return acc;
      },
      { purchase: 0, scheme: 0, sales: 0, balance: 0, purchaseValue: 0 },
    );
  }, [rows]);

  const purchaseCountUp = useCountUp(totals.purchase);
  const schemeCountUp = useCountUp(totals.scheme);
  const salesCountUp = useCountUp(totals.sales);
  const balanceCountUp = useCountUp(totals.balance);

  // On-hand quantity/value/status reflect live stock and aren't affected by
  // the date filter (only totalReceivedQuantity/totalSchemeQuantity/
  // totalSoldQuantity change with that filter - see the backend's
  // listDealerStock), so the Stock view reuses this same already-fetched
  // "items" list rather than issuing a second query, and has no date filter
  // control of its own.
  // currentQuantity isn't tracked by source (a sale debits the one shared
  // pool, so which specific units - purchased or scheme - actually left
  // can't be known after the fact). Purchased/Scheme Value below is
  // therefore an honest proportional split of the current Total Value,
  // weighted by how much of everything this product ever received came
  // from each source - not a claim about which exact units remain. It
  // always adds up to the Total exactly, which a lifetime-received split
  // wouldn't once anything's been sold.
  const sortedStockRows = useMemo(() => {
    return [...items]
      .map((item) => {
        const totalValue = Number(item.inventoryValue || 0);
        const totalAcquired = Number(item.totalReceivedQuantity || 0) + Number(item.totalSchemeQuantity || 0);
        const purchasedValue = totalAcquired > 0 ? (totalValue * item.totalReceivedQuantity) / totalAcquired : 0;
        const schemeValue = totalAcquired > 0 ? (totalValue * item.totalSchemeQuantity) / totalAcquired : 0;
        return { ...item, purchasedValue, schemeValue };
      })
      .sort((a, b) => {
        const catCompare = categoryLabel(a.category).localeCompare(categoryLabel(b.category));
        return catCompare !== 0 ? catCompare : (a.name || "").localeCompare(b.name || "");
      });
  }, [items]);

  const stockGroupHeaderByFirstId = useMemo(() => {
    const counts = new Map();
    for (const item of sortedStockRows) counts.set(item.category, (counts.get(item.category) || 0) + 1);
    const map = new Map();
    let lastCategory = null;
    for (const item of sortedStockRows) {
      if (item.category !== lastCategory) {
        map.set(item.productId, { label: categoryLabel(item.category), count: counts.get(item.category) });
        lastCategory = item.category;
      }
    }
    return map;
  }, [sortedStockRows]);

  const stockSummary = inventoryQuery.data?.summary || { totalValue: 0, totalUnits: 0, lowStockCount: 0, outOfStockCount: 0, totalProducts: 0 };

  // The server summary only covers current-state numbers (on-hand units/
  // value) - it has nothing about what was actually purchased over time.
  // Computed client-side from the same already-fetched "items" list rather
  // than a second query, same pattern as `totals` above.
  const purchaseSummary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const qty = Number(item.totalReceivedQuantity || 0);
        const unitCost = Number(item.lastKnownUnitCost || 0);
        acc.totalUnits += qty;
        acc.totalValue += qty * unitCost;
        return acc;
      },
      { totalUnits: 0, totalValue: 0 },
    );
  }, [items]);

  // Sum of the same per-row proportional split computed in sortedStockRows -
  // adds up to stockSummary.totalValue exactly, just broken into where it
  // came from.
  const valueSplitSummary = useMemo(() => {
    return sortedStockRows.reduce(
      (acc, row) => {
        acc.purchasedValue += row.purchasedValue;
        acc.schemeValue += row.schemeValue;
        return acc;
      },
      { purchasedValue: 0, schemeValue: 0 },
    );
  }, [sortedStockRows]);

  const purchasedCountUp = useCountUp(purchaseSummary.totalUnits);
  const onHandCountUp = useCountUp(stockSummary.totalUnits);

  const historySales = useMemo(() => salesForHistoryQuery.data?.items || [], [salesForHistoryQuery.data]);
  const historyOrders = useMemo(() => ordersForHistoryQuery.data?.items || [], [ordersForHistoryQuery.data]);
  const historyEvents = useMemo(() => buildHistoryEvents(historySales, historyOrders), [historySales, historyOrders]);
  const historyTotalPages = Math.max(1, Math.ceil(historyEvents.length / HISTORY_PAGE_SIZE));
  const historyCurrentPage = Math.min(historyPage, historyTotalPages);
  const historyVisibleEvents = historyEvents.slice((historyCurrentPage - 1) * HISTORY_PAGE_SIZE, historyCurrentPage * HISTORY_PAGE_SIZE);

  const historyGroupHeaderByKey = useMemo(() => {
    const counts = new Map();
    for (const event of historyVisibleEvents) {
      const dayKey = event.date.toDateString();
      counts.set(dayKey, (counts.get(dayKey) || 0) + 1);
    }
    const map = new Map();
    let lastDay = null;
    for (const event of historyVisibleEvents) {
      const dayKey = event.date.toDateString();
      if (dayKey !== lastDay) {
        map.set(event.key, { label: formatDayHeading(event.date), count: counts.get(dayKey) });
        lastDay = dayKey;
      }
    }
    return map;
  }, [historyVisibleEvents]);

  const historyLoading = (salesForHistoryQuery.isLoading && !salesForHistoryQuery.data) || (ordersForHistoryQuery.isLoading && !ordersForHistoryQuery.data);
  const historyFetching = salesForHistoryQuery.isFetching || ordersForHistoryQuery.isFetching;
  const historyError = salesForHistoryQuery.error
    ? getQueryErrorMessage(salesForHistoryQuery.error, "Failed to load sales history.")
    : ordersForHistoryQuery.error
      ? getQueryErrorMessage(ordersForHistoryQuery.error, "Failed to load purchase order history.")
      : "";

  const loadError = (view === "history" ? historyError : "") || (inventoryQuery.error ? getQueryErrorMessage(inventoryQuery.error, "Failed to load sales and purchases.") : "");
  const hasDateFilter = Boolean(filterFrom || filterTo);
  const dateLabel = dateRangeLabel(filterFrom, filterTo);

  function handleExportHistory() {
    const filenameSuffix = hasDateFilter ? `_${filterFrom}_to_${filterTo}` : "";
    exportToCsv(`${dealer?.companyName || "dealer"}-sales-purchases-history${filenameSuffix}`, [
      { key: "date", label: "Date", value: (event) => formatFilterDate(isoDateKey(event.date)) },
      { key: "type", label: "Type", value: (event) => (event.type === "sale" ? "Sale" : "Purchase") },
      { key: "reference", label: "Reference", value: (event) => (event.type === "sale" ? event.sale.billId || event.sale.saleNumber || "" : event.order.orderNumber || "") },
      { key: "items", label: "Items", value: (event) => (event.type === "sale" ? event.sale.items?.length : event.order.items?.length) || 0 },
      { key: "total", label: "Total", value: (event) => (event.type === "sale" ? event.sale.totals?.total : event.order.totals?.total) || 0 },
      { key: "status", label: "Status", value: (event) => (event.type === "sale" ? event.sale.status : event.order.status) || "" },
    ], historyEvents);
  }

  function handleExport() {
    const filenameSuffix = hasDateFilter ? `_${filterFrom}_to_${filterTo}` : "";
    exportToCsv(`${dealer?.companyName || "dealer"}-sales-purchases${filenameSuffix}`, [
      { key: "name", label: "Product Name" },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Category", value: (row) => categoryLabel(row.category) },
      { key: "purchase", label: "Purchase" },
      { key: "unitCost", label: "Unit Cost", value: (row) => row.unitCost },
      { key: "purchaseValue", label: "Purchase Value", value: (row) => row.purchaseValue },
      { key: "scheme", label: "Scheme" },
      { key: "sales", label: "Sales" },
      { key: "balance", label: "Balance" },
      { key: "date", label: "Date", value: () => dateLabel },
    ], sortedProductRows);
  }

  function handleExportStock() {
    exportToCsv(`${dealer?.companyName || "dealer"}-stock`, [
      { key: "name", label: "Product Name" },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Category", value: (item) => categoryLabel(item.category) },
      { key: "totalReceivedQuantity", label: "Total Purchased" },
      { key: "lastKnownUnitCost", label: "Unit Cost", value: (item) => item.lastKnownUnitCost || 0 },
      { key: "currentQuantity", label: "On Hand" },
      { key: "purchasedValue", label: "Purchased Value", value: (item) => Math.round(item.purchasedValue || 0) },
      { key: "schemeValue", label: "Scheme Value", value: (item) => Math.round(item.schemeValue || 0) },
      { key: "inventoryValue", label: "Total Value" },
      { key: "status", label: "Status", value: (item) => stockLabel(item.status) },
    ], sortedStockRows);
  }

  // ---- Columns ----

  const productColumns = useMemo(
    () => [
      {
        key: "product",
        header: "Product",
        isTitle: true,
        render: (row) => (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 650, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</div>
            {row.pack?.label ? (
              <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{row.pack.label}</div>
            ) : null}
          </div>
        ),
      },
      { key: "purchase", header: "Purchase", align: "right", cellClassName: () => "dash-table-tabular", render: (row) => formatQty(row.purchase) },
      {
        key: "scheme",
        header: "Scheme",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => (row.scheme > 0 ? formatQty(row.scheme) : <span style={{ color: "var(--color-graphite, #707070)" }}>—</span>),
      },
      { key: "sales", header: "Sales", align: "right", cellClassName: () => "dash-table-tabular", render: (row) => formatQty(row.sales) },
      {
        key: "balance",
        header: "Balance",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        // Color only carries a signal when something is actually wrong
        // (a negative balance means more was sold than the ledger says
        // this dealer ever received) - an ordinary positive balance is not
        // a "status" worth a colored pill, just a plain number.
        render: (row) => <strong style={{ color: row.balance < 0 ? "#b42318" : "var(--color-ink, #1d1d1f)" }}>{formatQty(row.balance)}</strong>,
      },
    ],
    [],
  );

  const productFooter = sortedProductRows.length
    ? [
        { key: "product", content: `${sortedProductRows.length} product${sortedProductRows.length === 1 ? "" : "s"} · Total`, align: "left" },
        {
          key: "purchase",
          content: (
            <>
              <div>{formatQty(purchaseCountUp)}</div>
              {totals.purchaseValue > 0 ? <div style={{ marginTop: 1, fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>{formatMoney(totals.purchaseValue)}</div> : null}
            </>
          ),
          align: "right",
        },
        { key: "scheme", content: formatQty(schemeCountUp), align: "right" },
        { key: "sales", content: formatQty(salesCountUp), align: "right" },
        { key: "balance", content: formatQty(balanceCountUp), align: "right" },
      ]
    : null;

  const stockColumns = useMemo(
    () => [
      {
        key: "product",
        header: "Product",
        isTitle: true,
        render: (item) => (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 650, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
            {item.pack?.label ? (
              <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{item.pack.label}</div>
            ) : null}
          </div>
        ),
      },
      { key: "purchased", header: "Purchased", align: "right", cellClassName: () => "dash-table-tabular", render: (item) => formatQty(item.totalReceivedQuantity) },
      { key: "unitCost", header: "Unit Cost", align: "right", cellClassName: () => "dash-table-tabular", render: (item) => (item.lastKnownUnitCost ? formatMoney(item.lastKnownUnitCost) : "—") },
      { key: "onHand", header: "On Hand", align: "right", cellClassName: () => "dash-table-tabular", render: (item) => <strong>{formatQty(item.currentQuantity)}</strong> },
      {
        key: "value",
        header: "Value",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (item) =>
          item.inventoryValue ? (
            <div>
              <strong>{formatMoney(item.inventoryValue)}</strong>
              <div style={{ marginTop: 1, fontSize: 11, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                Purchased {formatMoney(item.purchasedValue)} · Scheme {formatMoney(item.schemeValue)}
              </div>
            </div>
          ) : (
            "—"
          ),
      },
      { key: "status", header: "Status", render: (item) => <Pill tone={stockTone(item.status)} size="small">{stockLabel(item.status)}</Pill> },
    ],
    [],
  );

  const stockFooter = sortedStockRows.length
    ? [
        { key: "product", content: `${sortedStockRows.length} product${sortedStockRows.length === 1 ? "" : "s"} · Total`, align: "left" },
        { key: "purchased", content: formatQty(purchasedCountUp), align: "right" },
        { key: "unitCost", content: "", align: "right" },
        { key: "onHand", content: formatQty(onHandCountUp), align: "right" },
        {
          key: "value",
          content: (
            <div>
              <strong>{formatMoney(stockSummary.totalValue)}</strong>
              <div style={{ marginTop: 1, fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>
                Purchased {formatMoney(valueSplitSummary.purchasedValue)} · Scheme {formatMoney(valueSplitSummary.schemeValue)}
              </div>
            </div>
          ),
          align: "right",
        },
        { key: "status", content: "", align: "left" },
      ]
    : null;

  const historyColumns = useMemo(
    () => [
      { key: "time", header: "Time", render: (event) => formatTime(event.type === "sale" ? event.sale?.saleDate : event.order?.createdAt) },
      {
        key: "type",
        header: "Type",
        render: (event) => {
          if (event.type === "sale") {
            const voided = event.sale?.status === "VOIDED";
            return (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: voided ? "#b42318" : "#15803d" }}>
                <DashboardIcon name={voided ? "reject" : "checkSquare"} size={14} strokeWidth={1.8} />
                Sale
              </span>
            );
          }
          return (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--color-azure, #0071e3)" }}>
              <DashboardIcon name="truck" size={14} strokeWidth={1.8} />
              Purchase
            </span>
          );
        },
      },
      {
        key: "reference",
        header: "Reference",
        render: (event) => (event.type === "sale" ? event.sale?.billId || event.sale?.saleNumber || "Sale" : event.order?.orderNumber || "Order"),
      },
      {
        key: "items",
        header: "Items",
        align: "right",
        render: (event) => {
          const count = event.type === "sale" ? event.sale?.items?.length : event.order?.items?.length;
          return count || 0;
        },
      },
      {
        key: "amount",
        header: "Amount",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (event) => formatMoney(event.type === "sale" ? event.sale?.totals?.total : event.order?.totals?.total),
      },
      {
        key: "status",
        header: "Status",
        render: (event) => {
          if (event.type === "sale") {
            const voided = event.sale?.status === "VOIDED";
            return <Pill tone={voided ? "critical" : "positive"} size="small">{voided ? "Voided" : "Completed"}</Pill>;
          }
          const meta = orderStatusMeta(normalizeStatus(event.order?.status));
          return <Pill tone={meta.tone} size="small">{meta.label}</Pill>;
        },
      },
    ],
    [],
  );

  function goToProductHistory(productId) {
    navigate(`/admin/dashboard/dealers/${dealerId}/sales-purchases/${productId}/all`, {
      state: { fromSalesPurchases: true },
    });
  }

  // This page is reached from the dealer's profile and from the Sales list.
  // When we know which, go back through browser history so that page returns
  // exactly as it was left (filters, scroll, and the profile's own way back to
  // the dealers list). Opened any other way - a pasted link, a refresh - there
  // is no history to trust, so the dealer's profile is the sensible parent.
  const cameFromSales = Boolean(location.state?.fromSalesList);
  const cameFromProfile = Boolean(location.state?.fromDealerProfile);

  function goBack() {
    if (cameFromSales || cameFromProfile) navigate(-1);
    else navigate(`/admin/dashboard/dealers/${dealerId}`);
  }

  function openHistoryEvent(event) {
    if (event.type === "sale") setPreviewSale(event.sale);
    else setPreviewOrder(event.order);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <SalesPurchasesBackButton onClick={goBack}>{cameFromSales ? "Back to Sales" : "Back to Dealer Profile"}</SalesPurchasesBackButton>

      <Surface padding={20} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar label={dealer?.companyName || dealer?.contactName || "D"} size={44} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-ink, #1d1d1f)" }}>
                {dealer?.companyName || "Dealer"}
              </div>
              <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                Sales &amp; Purchases
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {view === "sales" || view === "history" ? (
              <DateRangeControl
                from={filterFrom}
                to={filterTo}
                onApply={(from, to) => {
                  setFilterFrom(from);
                  setFilterTo(to);
                  setHistoryPage(1);
                }}
                onClear={() => {
                  setFilterFrom("");
                  setFilterTo("");
                  setHistoryPage(1);
                }}
              />
            ) : null}
            {view === "sales" ? (
              <div style={{ width: 220 }}>
                <SearchField value={search} onChange={setSearch} placeholder="Search products…" />
              </div>
            ) : null}
            <GhostButton
              icon="download"
              onClick={view === "stock" ? handleExportStock : view === "history" ? handleExportHistory : handleExport}
              disabled={view === "stock" ? sortedStockRows.length === 0 : view === "history" ? historyEvents.length === 0 : sortedProductRows.length === 0}
            >
              Export
            </GhostButton>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <SegmentedControl
            options={[
              { key: "history", label: "Sales & Purchases" },
              { key: "sales", label: "By Product" },
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
        <Surface key="sales" padding={22} className="dash-fade-up">
          <SectionHeader
            icon="chart"
            title="By Product"
            subtitle={hasDateFilter ? `Purchase, scheme, and sale totals for ${dateLabel}.` : "Lifetime purchase, scheme, and sale totals, per product."}
            action={inventoryQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
          />

          <div style={{ marginTop: 18 }} className="admin-sp-datatable">
            <DataTable
              columns={productColumns}
              rows={sortedProductRows}
              getRowKey={(row) => row.productId}
              onRowClick={(row) => goToProductHistory(row.productId)}
              loading={inventoryQuery.isLoading && !inventoryQuery.data}
              renderGroupHeader={(row) => {
                const group = productGroupHeaderByFirstId.get(row.productId);
                if (!group) return null;
                return <GroupHeaderRow label={group.label} count={group.count} countLabel="product" />;
              }}
              footerCells={productFooter}
              emptyState={{
                icon: "chart",
                title: rows.length === 0 ? "No purchases yet" : "No matching products",
                subtitle: rows.length === 0 ? "This dealer hasn't received any delivered orders yet." : "Try a different search term.",
              }}
            />
          </div>
        </Surface>
      ) : view === "history" ? (
        <Surface key="history" padding={22} className="dash-fade-up">
          <SectionHeader
            icon="overview"
            title="Sales & Purchases"
            subtitle={hasDateFilter ? `Every purchase and sale for ${dateLabel}.` : "Every individual sale and purchase order for this dealer, newest first."}
            action={historyFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
          />

          <div style={{ marginTop: 18 }} className="admin-sp-datatable">
            <DataTable
              columns={historyColumns}
              rows={historyVisibleEvents}
              getRowKey={(event) => event.key}
              onRowClick={openHistoryEvent}
              loading={historyLoading}
              renderGroupHeader={(event) => {
                const group = historyGroupHeaderByKey.get(event.key);
                if (!group) return null;
                return <GroupHeaderRow label={group.label} count={group.count} countLabel="record" />;
              }}
              emptyState={{
                icon: "overview",
                title: "No activity yet",
                subtitle: hasDateFilter ? "Nothing happened in this date range." : "This dealer hasn't ordered or sold anything yet.",
              }}
            />
          </div>

          {!historyLoading && historyEvents.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <Pagination page={historyCurrentPage} totalPages={historyTotalPages} totalCount={historyEvents.length} itemLabel="entries" onChange={setHistoryPage} />
            </div>
          ) : null}
        </Surface>
      ) : (
        <Surface key="stock" padding={22} className="dash-fade-up">
          <SectionHeader
            icon="stock"
            title="Stock"
            subtitle="Live on-hand stock, per product - not affected by the date filter."
            action={
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {stockSummary.lowStockCount > 0 ? <Pill tone="caution" size="small">{stockSummary.lowStockCount} low</Pill> : null}
                {stockSummary.outOfStockCount > 0 ? <Pill tone="critical" size="small">{stockSummary.outOfStockCount} out</Pill> : null}
                {inventoryQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
              </div>
            }
          />

          <div style={{ marginTop: 18 }} className="admin-sp-datatable">
            <DataTable
              columns={stockColumns}
              rows={sortedStockRows}
              getRowKey={(item) => item.productId}
              loading={inventoryQuery.isLoading && !inventoryQuery.data}
              renderGroupHeader={(item) => {
                const group = stockGroupHeaderByFirstId.get(item.productId);
                if (!group) return null;
                return <GroupHeaderRow label={group.label} count={group.count} countLabel="product" />;
              }}
              footerCells={stockFooter}
              emptyState={{ icon: "stock", title: "No stock yet", subtitle: "This dealer hasn't received any delivered orders yet." }}
            />
          </div>
        </Surface>
      )}

      <HistoryOrderPreviewModal order={previewOrder} onClose={() => setPreviewOrder(null)} />
      <HistorySaleDetailModal sale={previewSale} onClose={() => setPreviewSale(null)} />

      <SalesPurchasesStyles />
    </div>
  );
}
