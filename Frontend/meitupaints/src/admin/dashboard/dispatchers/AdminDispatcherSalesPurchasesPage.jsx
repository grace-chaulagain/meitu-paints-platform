import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  useGetAdminDispatcherQuery,
  useGetAdminDispatcherProductSummaryQuery,
  useGetAdminDispatcherOwnOrdersQuery,
  useGetAdminDispatcherFulfilledOrdersQuery,
  useGetAdminDispatcherStockQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { exportToCsv } from "../../../utils/exportToCsv.js";
import { formatTime, normalizeStatus, orderStatusMeta } from "../../../dealer/orderDetailLogic.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
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
  categoryHeadersByFirstRow,
  categoryLabel,
  dateRangeLabel,
  dateRangeParams,
  dayHeadersByFirstEvent,
  formatFilterDate,
  formatMoney,
  formatQty,
  isoDateKey,
  sortByCategoryThenName,
  stockLabel,
  stockTone,
} from "../salesPurchases/salesPurchasesFormat.js";
import {
  DateRangeControl,
  GroupHeaderRow,
  HistoryOrderPreviewModal,
  SalesPurchasesBackButton,
  SalesPurchasesStyles,
} from "../salesPurchases/SalesPurchasesKit.jsx";
import DispatcherHubMark from "./DispatcherHubMark.jsx";

// The dispatcher's Sales & Purchases, built from the same pieces as the dealer
// page (AdminDealerSalesPurchasesPage.jsx) and laid out the same way. The data
// underneath differs: a dispatcher buys from the Factory (its replenishment
// orders) and "sells" by fulfilling its dealers' orders - it has no walk-in
// sales of its own. Totals are summed from the orders themselves
// (admin.service.js getDispatcherProductSummary); on production they match
// the dispatcher stock ledger (DispatcherStockMovement) unit for unit.

const HISTORY_PAGE_SIZE = 20;
// The dealer page loads the latest 100 of each; the same ceiling here.
const HISTORY_FETCH_LIMIT = 100;
// Every stock row a dispatcher holds in one request - bounded by the catalog
// (200 products on production); the admin stock endpoint allows up to 1,000.
const STOCK_FETCH_LIMIT = 1000;

// One row per order - a purchase from the Factory or a dealer order this
// dispatcher fulfilled - never one per line item.
function buildHistoryEvents(purchases, sales) {
  const purchaseEvents = purchases.map((order) => ({ type: "purchase", key: `purchase-${order._id}`, date: new Date(order.createdAt), order }));
  const saleEvents = sales.map((order) => ({ type: "sale", key: `sale-${order._id}`, date: new Date(order.createdAt), order }));
  return [...purchaseEvents, ...saleEvents]
    .filter((event) => !Number.isNaN(event.date.getTime()))
    .sort((a, b) => b.date - a.date);
}

function dealerNameOf(order) {
  return order?.dealerId?.companyName || order?.dealerSnapshot?.companyName || "Dealer";
}

// Where a stock value came from, naming only the sources that contributed -
// "Purchased Rs 900 · Opening Rs 300", never a row of zeroes.
function ValueSplit({ opening, purchased, scheme, weight = 500 }) {
  const parts = [
    ["Opening", opening],
    ["Purchased", purchased],
    ["Scheme", scheme],
  ].filter(([, value]) => Math.round(value) > 0);
  if (!parts.length) return null;
  return (
    <div style={{ marginTop: 1, fontSize: 11, fontWeight: weight, color: "var(--color-graphite, #707070)" }}>
      {parts.map(([label, value]) => `${label} ${formatMoney(value)}`).join(" · ")}
    </div>
  );
}

// The stock endpoint reports quantity and value but no status; the rule is the
// dealer side's: nothing left is out, at or under the threshold is low.
function stockStatusOf(item) {
  const quantity = Number(item.currentQuantity || 0);
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (Number(item.lowStockThreshold || 0) > 0 && quantity <= Number(item.lowStockThreshold)) return "LOW_STOCK";
  return "IN_STOCK";
}

export default function AdminDispatcherSalesPurchasesPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const dispatcherId = useMemo(() => {
    const match = location.pathname.match(/^\/admin\/dashboard\/dispatchers\/([^/]+)\/sales-purchases$/);
    return match?.[1] || "";
  }, [location.pathname]);

  const [view, setView] = useState("history");
  const [search, setSearch] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [previewEvent, setPreviewEvent] = useState(null);

  const range = dateRangeParams(filterFrom, filterTo);
  const hasDateFilter = Boolean(filterFrom || filterTo);

  const dispatcherQuery = useGetAdminDispatcherQuery(dispatcherId, { skip: !dispatcherId });
  const summaryQuery = useGetAdminDispatcherProductSummaryQuery({ dispatcherId, ...range }, { skip: !dispatcherId });
  // Stock is live and not date-bound, so its Opening and Purchased columns
  // always read the lifetime summary (the same request as above when no range
  // is set).
  const lifetimeSummaryQuery = useGetAdminDispatcherProductSummaryQuery({ dispatcherId }, { skip: !dispatcherId || view !== "stock" });
  const stockQuery = useGetAdminDispatcherStockQuery({ dispatcherId, limit: STOCK_FETCH_LIMIT }, { skip: !dispatcherId || view !== "stock" });
  const purchasesQuery = useGetAdminDispatcherOwnOrdersQuery(
    { dispatcherId, ...range, limit: HISTORY_FETCH_LIMIT },
    { skip: !dispatcherId || view !== "history" },
  );
  const salesQuery = useGetAdminDispatcherFulfilledOrdersQuery(
    { dispatcherId, ...range, limit: HISTORY_FETCH_LIMIT },
    { skip: !dispatcherId || view !== "history" },
  );

  const dispatcher = dispatcherQuery.data?.item || null;
  const displayName = dispatcher?.name || dispatcher?.companyName || "Dispatcher";
  const items = useMemo(() => summaryQuery.data?.items || [], [summaryQuery.data]);

  const rows = useMemo(() => {
    return items.map((item) => {
      const purchase = Number(item.purchase || 0);
      const scheme = Number(item.scheme || 0);
      const sales = Number(item.sales || 0);
      return {
        productId: item.productId,
        name: item.name || "Unnamed product",
        sku: item.sku || "",
        category: item.category || "",
        pack: item.pack || {},
        purchase,
        scheme,
        sales,
        // Only what these three columns account for. Stock a dispatcher held
        // before any order was recorded (opening stock) is left to the Stock
        // view, so a product nobody bought or sold reads 0 here, not 12.
        balance: purchase + scheme - sales,
        purchaseValue: Number(item.purchaseValue || 0),
      };
    });
  }, [items]);

  // Only products that moved: bought, granted or sold (in the chosen dates).
  // Stock held from before orders were recorded, with no activity since, lives
  // in the Stock view - listing it here would just be rows of zeroes.
  const activeRows = useMemo(() => rows.filter((row) => row.purchase || row.scheme || row.sales), [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeRows;
    return activeRows.filter(
      (row) => row.name.toLowerCase().includes(q) || row.sku.toLowerCase().includes(q) || row.category.toLowerCase().includes(q),
    );
  }, [activeRows, search]);

  const sortedProductRows = useMemo(() => sortByCategoryThenName(filteredRows), [filteredRows]);
  const productGroupHeaderByFirstId = useMemo(() => categoryHeadersByFirstRow(sortedProductRows), [sortedProductRows]);

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

  // Stock rows: live quantity and value from the stock endpoint, lifetime
  // purchased/scheme/sold from the summary.
  //
  // Opening is stock the dispatcher already held before any order was
  // recorded - on production it is most of what the older dispatchers hold,
  // and no order or stock-ledger entry exists for it. It is simply whatever
  // is on hand beyond what the orders account for.
  //
  // As on the dealer page, which exact units remain can't be known once some
  // were sold, so the value is split by how much of this product came from
  // each source (opening, purchased, scheme) - it always adds up exactly.
  const sortedStockRows = useMemo(() => {
    const lifetimeById = new Map((lifetimeSummaryQuery.data?.items || []).map((item) => [String(item.productId), item]));
    const stockRows = (stockQuery.data?.items || []).map((item) => {
      const lifetime = lifetimeById.get(String(item.productId)) || {};
      const purchased = Number(lifetime.purchase || 0);
      const scheme = Number(lifetime.scheme || 0);
      const sold = Number(lifetime.sales || 0);
      const onHand = Number(item.currentQuantity || 0);
      const opening = Math.max(0, onHand - (purchased + scheme - sold));
      const totalValue = Number(item.inventoryValue || 0);
      const entered = opening + purchased + scheme;
      const share = (units) => (entered > 0 ? (totalValue * units) / entered : 0);
      return {
        productId: item.productId,
        name: item.name || "Unnamed product",
        sku: item.sku || "",
        category: item.category || "",
        pack: item.pack || {},
        opening,
        purchased,
        onHand,
        unitCost: onHand > 0 ? totalValue / onHand : 0,
        inventoryValue: totalValue,
        openingValue: share(opening),
        purchasedValue: share(purchased),
        schemeValue: share(scheme),
        status: stockStatusOf(item),
      };
    });
    return sortByCategoryThenName(stockRows);
  }, [stockQuery.data, lifetimeSummaryQuery.data]);

  const stockGroupHeaderByFirstId = useMemo(() => categoryHeadersByFirstRow(sortedStockRows), [sortedStockRows]);

  const stockSummary = useMemo(() => {
    return sortedStockRows.reduce(
      (acc, row) => {
        acc.opening += row.opening;
        acc.purchased += row.purchased;
        acc.onHand += row.onHand;
        acc.totalValue += row.inventoryValue;
        acc.openingValue += row.openingValue;
        acc.purchasedValue += row.purchasedValue;
        acc.schemeValue += row.schemeValue;
        if (row.status === "LOW_STOCK") acc.lowStockCount += 1;
        if (row.status === "OUT_OF_STOCK") acc.outOfStockCount += 1;
        return acc;
      },
      { opening: 0, purchased: 0, onHand: 0, totalValue: 0, openingValue: 0, purchasedValue: 0, schemeValue: 0, lowStockCount: 0, outOfStockCount: 0 },
    );
  }, [sortedStockRows]);

  const openingCountUp = useCountUp(stockSummary.opening);
  const purchasedCountUp = useCountUp(stockSummary.purchased);
  const onHandCountUp = useCountUp(stockSummary.onHand);

  const historyPurchases = useMemo(() => purchasesQuery.data?.items || [], [purchasesQuery.data]);
  const historySales = useMemo(() => salesQuery.data?.items || [], [salesQuery.data]);
  const historyEvents = useMemo(() => buildHistoryEvents(historyPurchases, historySales), [historyPurchases, historySales]);
  const historyTotalPages = Math.max(1, Math.ceil(historyEvents.length / HISTORY_PAGE_SIZE));
  const historyCurrentPage = Math.min(historyPage, historyTotalPages);
  const historyVisibleEvents = historyEvents.slice((historyCurrentPage - 1) * HISTORY_PAGE_SIZE, historyCurrentPage * HISTORY_PAGE_SIZE);
  const historyGroupHeaderByKey = useMemo(() => dayHeadersByFirstEvent(historyVisibleEvents), [historyVisibleEvents]);

  const historyLoading = (purchasesQuery.isLoading && !purchasesQuery.data) || (salesQuery.isLoading && !salesQuery.data);
  const historyFetching = purchasesQuery.isFetching || salesQuery.isFetching;
  const historyError = purchasesQuery.error
    ? getQueryErrorMessage(purchasesQuery.error, "Failed to load purchase history.")
    : salesQuery.error
      ? getQueryErrorMessage(salesQuery.error, "Failed to load sales history.")
      : "";
  const stockError = stockQuery.error ? getQueryErrorMessage(stockQuery.error, "Failed to load stock.") : "";

  const loadError =
    (view === "history" ? historyError : "") ||
    (view === "stock" ? stockError : "") ||
    (summaryQuery.error ? getQueryErrorMessage(summaryQuery.error, "Failed to load sales and purchases.") : "");
  const dateLabel = dateRangeLabel(filterFrom, filterTo);
  const fileName = dispatcher?.companyName || dispatcher?.name || "dispatcher";

  function handleExportHistory() {
    const filenameSuffix = hasDateFilter ? `_${filterFrom}_to_${filterTo}` : "";
    exportToCsv(`${fileName}-sales-purchases-history${filenameSuffix}`, [
      { key: "date", label: "Date", value: (event) => formatFilterDate(isoDateKey(event.date)) },
      { key: "type", label: "Type", value: (event) => (event.type === "sale" ? "Sale" : "Purchase") },
      { key: "reference", label: "Reference", value: (event) => event.order.orderNumber || "" },
      { key: "party", label: "Dealer / Supplier", value: (event) => (event.type === "sale" ? dealerNameOf(event.order) : "Factory") },
      { key: "items", label: "Items", value: (event) => event.order.items?.length || 0 },
      { key: "total", label: "Total", value: (event) => event.order.totals?.total || 0 },
      { key: "status", label: "Status", value: (event) => event.order.status || "" },
    ], historyEvents);
  }

  function handleExport() {
    const filenameSuffix = hasDateFilter ? `_${filterFrom}_to_${filterTo}` : "";
    exportToCsv(`${fileName}-sales-purchases${filenameSuffix}`, [
      { key: "name", label: "Product Name" },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Category", value: (row) => categoryLabel(row.category) },
      { key: "purchase", label: "Purchase" },
      { key: "purchaseValue", label: "Purchase Value", value: (row) => row.purchaseValue },
      { key: "scheme", label: "Scheme" },
      { key: "sales", label: "Sales" },
      { key: "balance", label: "Balance" },
      { key: "date", label: "Date", value: () => dateLabel },
    ], sortedProductRows);
  }

  function handleExportStock() {
    exportToCsv(`${fileName}-stock`, [
      { key: "name", label: "Product Name" },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Category", value: (row) => categoryLabel(row.category) },
      { key: "opening", label: "Opening Stock" },
      { key: "purchased", label: "Total Purchased" },
      { key: "unitCost", label: "Unit Cost", value: (row) => Math.round(row.unitCost || 0) },
      { key: "onHand", label: "On Hand" },
      { key: "openingValue", label: "Opening Value", value: (row) => Math.round(row.openingValue || 0) },
      { key: "purchasedValue", label: "Purchased Value", value: (row) => Math.round(row.purchasedValue || 0) },
      { key: "schemeValue", label: "Scheme Value", value: (row) => Math.round(row.schemeValue || 0) },
      { key: "inventoryValue", label: "Total Value" },
      { key: "status", label: "Status", value: (row) => stockLabel(row.status) },
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
        // Colour only when something is actually wrong - a negative balance.
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
        render: (row) => (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 650, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</div>
            {row.pack?.label ? (
              <div style={{ marginTop: 2, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{row.pack.label}</div>
            ) : null}
          </div>
        ),
      },
      {
        key: "opening",
        header: "Opening",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) => (row.opening > 0 ? formatQty(row.opening) : <span style={{ color: "var(--color-graphite, #707070)" }}>—</span>),
      },
      { key: "purchased", header: "Purchased", align: "right", cellClassName: () => "dash-table-tabular", render: (row) => formatQty(row.purchased) },
      { key: "unitCost", header: "Unit Cost", align: "right", cellClassName: () => "dash-table-tabular", render: (row) => (row.unitCost ? formatMoney(row.unitCost) : "—") },
      { key: "onHand", header: "On Hand", align: "right", cellClassName: () => "dash-table-tabular", render: (row) => <strong>{formatQty(row.onHand)}</strong> },
      {
        key: "value",
        header: "Value",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (row) =>
          row.inventoryValue ? (
            <div>
              <strong>{formatMoney(row.inventoryValue)}</strong>
              <ValueSplit opening={row.openingValue} purchased={row.purchasedValue} scheme={row.schemeValue} />
            </div>
          ) : (
            "—"
          ),
      },
      { key: "status", header: "Status", render: (row) => <Pill tone={stockTone(row.status)} size="small">{stockLabel(row.status)}</Pill> },
    ],
    [],
  );

  const stockFooter = sortedStockRows.length
    ? [
        { key: "product", content: `${sortedStockRows.length} product${sortedStockRows.length === 1 ? "" : "s"} · Total`, align: "left" },
        { key: "opening", content: formatQty(openingCountUp), align: "right" },
        { key: "purchased", content: formatQty(purchasedCountUp), align: "right" },
        { key: "unitCost", content: "", align: "right" },
        { key: "onHand", content: formatQty(onHandCountUp), align: "right" },
        {
          key: "value",
          content: (
            <div>
              <strong>{formatMoney(stockSummary.totalValue)}</strong>
              <ValueSplit
                opening={stockSummary.openingValue}
                purchased={stockSummary.purchasedValue}
                scheme={stockSummary.schemeValue}
                weight={600}
              />
            </div>
          ),
          align: "right",
        },
        { key: "status", content: "", align: "left" },
      ]
    : null;

  const historyColumns = useMemo(
    () => [
      { key: "time", header: "Time", render: (event) => formatTime(event.order?.createdAt) },
      {
        key: "type",
        header: "Type",
        render: (event) =>
          event.type === "sale" ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#15803d" }}>
              <DashboardIcon name="checkSquare" size={14} strokeWidth={1.8} />
              Sale
            </span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--color-azure, #0071e3)" }}>
              <DashboardIcon name="truck" size={14} strokeWidth={1.8} />
              Purchase
            </span>
          ),
      },
      {
        key: "reference",
        header: "Reference",
        render: (event) => (
          <div style={{ minWidth: 0 }}>
            <div>{event.order?.orderNumber || "Order"}</div>
            <div style={{ marginTop: 1, fontSize: 11.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              {event.type === "sale" ? `To ${dealerNameOf(event.order)}` : "From the Factory"}
            </div>
          </div>
        ),
      },
      { key: "items", header: "Items", align: "right", render: (event) => event.order?.items?.length || 0 },
      {
        key: "amount",
        header: "Amount",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (event) => formatMoney(event.order?.totals?.total),
      },
      {
        key: "status",
        header: "Status",
        render: (event) => {
          const meta = orderStatusMeta(normalizeStatus(event.order?.status));
          return <Pill tone={meta.tone} size="small">{meta.label}</Pill>;
        },
      },
    ],
    [],
  );

  function goToProductHistory(productId) {
    navigate(`/admin/dashboard/dispatchers/${dispatcherId}/sales-purchases/${productId}/all`, {
      state: { fromSalesPurchases: true },
    });
  }

  // Opened from the dispatcher's profile, Back steps through history so the
  // profile returns as it was left. Any other way in (a pasted link, a
  // refresh) has no history to trust, so the profile is the sensible parent.
  const cameFromProfile = Boolean(location.state?.fromDispatcherProfile);

  function goBack() {
    if (cameFromProfile) navigate(-1);
    else navigate(`/admin/dashboard/dispatchers/${dispatcherId}`);
  }

  function applyRange(from, to) {
    setFilterFrom(from);
    setFilterTo(to);
    setHistoryPage(1);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <SalesPurchasesBackButton onClick={goBack}>Back to Dispatcher Profile</SalesPurchasesBackButton>

      <Surface padding={20} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <DispatcherHubMark label={displayName} size={44} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-ink, #1d1d1f)" }}>{displayName}</div>
              <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>Sales &amp; Purchases</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {view === "sales" || view === "history" ? (
              <DateRangeControl from={filterFrom} to={filterTo} onApply={applyRange} onClear={() => applyRange("", "")} />
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
            action={summaryQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
          />

          <div style={{ marginTop: 18 }} className="admin-sp-datatable">
            <DataTable
              columns={productColumns}
              rows={sortedProductRows}
              getRowKey={(row) => row.productId}
              onRowClick={(row) => goToProductHistory(row.productId)}
              loading={summaryQuery.isLoading && !summaryQuery.data}
              renderGroupHeader={(row) => {
                const group = productGroupHeaderByFirstId.get(row.productId);
                if (!group) return null;
                return <GroupHeaderRow label={group.label} count={group.count} countLabel="product" />;
              }}
              footerCells={productFooter}
              emptyState={{
                icon: "chart",
                title: activeRows.length === 0 ? (hasDateFilter ? "Nothing moved in these dates" : "No purchases yet") : "No matching products",
                subtitle:
                  activeRows.length === 0
                    ? hasDateFilter
                      ? "No purchases, scheme grants or sales in this date range."
                      : "This dispatcher hasn't bought, been granted or sold anything yet. Stock it already held is in the Stock tab."
                    : "Try a different search term.",
              }}
            />
          </div>
        </Surface>
      ) : view === "history" ? (
        <Surface key="history" padding={22} className="dash-fade-up">
          <SectionHeader
            icon="overview"
            title="Sales & Purchases"
            subtitle={
              hasDateFilter
                ? `Every purchase and sale for ${dateLabel}.`
                : "Every Factory purchase and every dealer order this dispatcher fulfilled, newest first."
            }
            action={historyFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
          />

          <div style={{ marginTop: 18 }} className="admin-sp-datatable">
            <DataTable
              columns={historyColumns}
              rows={historyVisibleEvents}
              getRowKey={(event) => event.key}
              onRowClick={setPreviewEvent}
              loading={historyLoading}
              renderGroupHeader={(event) => {
                const group = historyGroupHeaderByKey.get(event.key);
                if (!group) return null;
                return <GroupHeaderRow label={group.label} count={group.count} countLabel="record" />;
              }}
              emptyState={{
                icon: "overview",
                title: "No activity yet",
                subtitle: hasDateFilter ? "Nothing happened in this date range." : "This dispatcher hasn't bought or fulfilled anything yet.",
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
            subtitle="Live on-hand stock, per product - not affected by the date filter. Opening is stock held before orders were recorded."
            action={
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {stockSummary.lowStockCount > 0 ? <Pill tone="caution" size="small">{stockSummary.lowStockCount} low</Pill> : null}
                {stockSummary.outOfStockCount > 0 ? <Pill tone="critical" size="small">{stockSummary.outOfStockCount} out</Pill> : null}
                {stockQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
              </div>
            }
          />

          <div style={{ marginTop: 18 }} className="admin-sp-datatable">
            <DataTable
              columns={stockColumns}
              rows={sortedStockRows}
              getRowKey={(row) => row.productId}
              loading={stockQuery.isLoading && !stockQuery.data}
              renderGroupHeader={(row) => {
                const group = stockGroupHeaderByFirstId.get(row.productId);
                if (!group) return null;
                return <GroupHeaderRow label={group.label} count={group.count} countLabel="product" />;
              }}
              footerCells={stockFooter}
              emptyState={{ icon: "stock", title: "No stock yet", subtitle: "This dispatcher doesn't hold any stock right now." }}
            />
          </div>
        </Surface>
      )}

      <HistoryOrderPreviewModal
        order={previewEvent?.order || null}
        party={previewEvent ? (previewEvent.type === "sale" ? `To ${dealerNameOf(previewEvent.order)}` : "From the Factory") : ""}
        onClose={() => setPreviewEvent(null)}
      />

      <SalesPurchasesStyles />
    </div>
  );
}
