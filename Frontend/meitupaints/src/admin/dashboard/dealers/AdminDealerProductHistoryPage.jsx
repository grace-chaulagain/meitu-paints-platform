import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  useGetAdminDealerQuery,
  useGetAdminDealerInventoryQuery,
  useGetAdminDealerInventoryMovementsQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { formatTime, normalizeStatus, orderStatusMeta } from "../../../dealer/orderDetailLogic.js";
import {
  Avatar,
  DashboardUIStyles,
  EmptyState,
  Pill,
  SectionHeader,
  SegmentedControl,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { scrollResultsToTop } from "../../../utils/scrollResultsToTop.js";
import { groupEventsByDay } from "../salesPurchases/salesPurchasesFormat.js";
import { HistoryOrderPreviewModal, HistorySaleDetailModal } from "../salesPurchases/SalesPurchasesKit.jsx";
import {
  BackLink,
  ProductHistoryCard,
  ProductHistoryDayGroup,
  ProductHistoryPagination,
  ProductHistoryStyles,
} from "../salesPurchases/ProductHistoryKit.jsx";

const HISTORY_DAYS_PAGE_SIZE = 6;

const VIEW_OPTIONS = [
  { key: "all", label: "Sales and Purchases" },
  { key: "purchases", label: "Purchases" },
  { key: "sales", label: "Sales" },
];

// Movements are a single ledger of many entry types (PURCHASE, SALE, RETURN,
// ADJUSTMENT, TRANSFER_*) - normalized here into one "event" shape (mirrors
// the same normalize-then-group-by-day pattern already used for the dealer's
// own combined History tab) so purchase and sale movements can be sorted and
// grouped by calendar day together, regardless of which tab is active.
function buildProductHistoryEvents(movements) {
  return movements
    .map((movement) => ({
      type: movement.type === "SALE" ? "sale" : "order",
      key: movement._id,
      date: new Date(movement.createdAt),
      movement,
    }))
    .filter((event) => !Number.isNaN(event.date.getTime()))
    .sort((a, b) => b.date - a.date);
}

function ProductOrderCard({ movement, onOpen, style }) {
  const order = movement.orderId;
  const meta = orderStatusMeta(normalizeStatus(order?.status));
  return (
    <ProductHistoryCard
      variant="order"
      icon="truck"
      kind="Purchase"
      title={order?.orderNumber || "Unnamed Order"}
      sub={formatTime(movement.createdAt)}
      pill={<Pill tone={meta.tone} size="small">{meta.label}</Pill>}
      quantity={movement.quantity}
      onClick={() => order && onOpen(order)}
      style={style}
    />
  );
}

function ProductSaleCard({ movement, onOpen, style }) {
  const sale = movement.saleId;
  const voided = sale?.status === "VOIDED";
  return (
    <ProductHistoryCard
      variant="sale"
      voided={voided}
      icon={voided ? "reject" : "checkSquare"}
      kind="Sale"
      title={sale?.saleNumber || "Sale"}
      sub={`${formatTime(movement.createdAt)}${sale?.billId ? ` · Bill ${sale.billId}` : ""}`}
      pill={<Pill tone={voided ? "critical" : "positive"} size="small">{voided ? "Voided" : "Completed"}</Pill>}
      quantity={movement.quantity}
      onClick={() => sale && onOpen(sale)}
      style={style}
    />
  );
}

export default function AdminDealerProductHistoryPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { dealerId, productId, mode } = useMemo(() => {
    const match = location.pathname.match(
      /^\/admin\/dashboard\/dealers\/([^/]+)\/sales-purchases\/([^/]+)\/(purchases|sales|all)$/,
    );
    return { dealerId: match?.[1] || "", productId: match?.[2] || "", mode: match?.[3] || "all" };
  }, [location.pathname]);

  // "view" is derived from the URL ("mode") rather than the other way
  // around - changeView() only navigates, it never sets view/page itself.
  // The sync check below (adjusting state during render, not inside an
  // effect - React's recommended pattern for this) catches every way the
  // URL can change: a tab click, or the browser back/forward button
  // landing on a different product/mode entirely while this same page
  // component instance stays mounted.
  const [syncKey, setSyncKey] = useState(`${productId}:${mode}`);
  const [view, setView] = useState(mode);
  const [page, setPage] = useState(1);
  const [previewOrder, setPreviewOrder] = useState(null);
  const [previewSale, setPreviewSale] = useState(null);

  const urlKey = `${productId}:${mode}`;
  if (syncKey !== urlKey) {
    setSyncKey(urlKey);
    setView(mode);
    setPage(1);
  }

  const dealerQuery = useGetAdminDealerQuery(dealerId, { skip: !dealerId });
  const inventoryQuery = useGetAdminDealerInventoryQuery(dealerId, { skip: !dealerId });
  const movementsQuery = useGetAdminDealerInventoryMovementsQuery(
    { dealerId, productId, type: "ALL", limit: 200 },
    { skip: !dealerId || !productId },
  );

  const dealer = dealerQuery.data?.item || null;
  const product = useMemo(
    () => (inventoryQuery.data?.items || []).find((item) => String(item.productId) === String(productId)) || null,
    [inventoryQuery.data, productId],
  );

  const movements = useMemo(() => movementsQuery.data?.items || [], [movementsQuery.data]);

  // Purchases and sales only ("orders and sales", not the full ledger) -
  // returns/adjustments/transfers are excluded from all three tabs.
  const filteredMovements = useMemo(() => {
    if (view === "purchases") return movements.filter((movement) => movement.type === "PURCHASE");
    if (view === "sales") return movements.filter((movement) => movement.type === "SALE");
    return movements.filter((movement) => movement.type === "PURCHASE" || movement.type === "SALE");
  }, [movements, view]);

  const dayGroups = useMemo(() => groupEventsByDay(buildProductHistoryEvents(filteredMovements)), [filteredMovements]);
  const totalPages = Math.max(1, Math.ceil(dayGroups.length / HISTORY_DAYS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleDayGroups = dayGroups.slice((currentPage - 1) * HISTORY_DAYS_PAGE_SIZE, currentPage * HISTORY_DAYS_PAGE_SIZE);

  function changeView(nextView) {
    // Carry the state across: a replace without it would forget how we got here.
    navigate(`/admin/dashboard/dealers/${dealerId}/sales-purchases/${productId}/${nextView}`, {
      replace: true,
      state: location.state,
    });
  }

  // Stepping back through history (rather than pushing a fresh Sales &
  // Purchases page) returns to the entry we came from, which still remembers
  // whether it was opened from the Sales list or the dealer's profile.
  function goBack() {
    if (location.state?.fromSalesPurchases) navigate(-1);
    else navigate(`/admin/dashboard/dealers/${dealerId}/sales-purchases`);
  }

  const movementsError = movementsQuery.error ? getQueryErrorMessage(movementsQuery.error, "Failed to load product history.") : "";

  const productLabel = product ? `${product.name}${product.pack?.label ? ` · ${product.pack.label}` : ""}` : "";

  const viewCopy = {
    all: { icon: "overview", title: "Sales and Purchases", empty: "No activity yet", emptySubtitle: "This dealer hasn't ordered or sold this product yet." },
    purchases: { icon: "truck", title: "Purchases", empty: "No purchases yet", emptySubtitle: "This product hasn't been delivered to this dealer yet." },
    sales: { icon: "handshake", title: "Sales", empty: "No sales yet", emptySubtitle: "This dealer hasn't sold this product yet." },
  }[view];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <BackLink onClick={goBack}>Back to Sales &amp; Purchases</BackLink>

      <Surface padding={20} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar label={dealer?.companyName || dealer?.contactName || "D"} size={44} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-ink, #1d1d1f)" }}>
                {dealer?.companyName || "Dealer"} · {viewCopy.title}
              </div>
              <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                {productLabel || "Loading product…"}
              </div>
            </div>
          </div>

          <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={changeView} />
        </div>
      </Surface>

      {movementsError ? (
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
          {movementsError}
        </div>
      ) : null}

      <Surface padding={26} className="dash-fade-up" key={view}>
        <SectionHeader
          icon={viewCopy.icon}
          title={viewCopy.title}
          subtitle={productLabel}
          action={movementsQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
        />

        <div style={{ marginTop: 16 }}>
          {movementsQuery.isLoading && !movementsQuery.data ? (
            <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
          ) : dayGroups.length === 0 ? (
            <EmptyState icon={viewCopy.icon} title={viewCopy.empty} subtitle={viewCopy.emptySubtitle} />
          ) : (
            <>
              <div className="admin-sph-timeline">
                {visibleDayGroups.map((group) => (
                  <ProductHistoryDayGroup
                    key={group.key}
                    group={group}
                    animate
                    renderEvent={(event, style) =>
                      event.type === "order" ? (
                        <ProductOrderCard key={event.key} movement={event.movement} onOpen={setPreviewOrder} style={style} />
                      ) : (
                        <ProductSaleCard key={event.key} movement={event.movement} onOpen={setPreviewSale} style={style} />
                      )
                    }
                  />
                ))}
              </div>
              <ProductHistoryPagination
                page={currentPage}
                totalPages={totalPages}
                totalCount={dayGroups.length}
                pageSize={HISTORY_DAYS_PAGE_SIZE}
                onChange={(next) => {
                  setPage(next);
                  scrollResultsToTop();
                }}
              />
            </>
          )}
        </div>
      </Surface>

      <HistoryOrderPreviewModal order={previewOrder} onClose={() => setPreviewOrder(null)} />
      <HistorySaleDetailModal sale={previewSale} onClose={() => setPreviewSale(null)} />

      <ProductHistoryStyles />
    </div>
  );
}
