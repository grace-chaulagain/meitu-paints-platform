import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  useGetAdminDispatcherQuery,
  useGetAdminDispatcherProductSummaryQuery,
  useGetAdminDispatcherProductMovementsQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { formatTime, normalizeStatus, orderStatusMeta } from "../../../dealer/orderDetailLogic.js";
import {
  DashboardUIStyles,
  EmptyState,
  Pill,
  SectionHeader,
  SegmentedControl,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { scrollResultsToTop } from "../../../utils/scrollResultsToTop.js";
import { groupEventsByDay } from "../salesPurchases/salesPurchasesFormat.js";
import { HistoryOrderPreviewModal } from "../salesPurchases/SalesPurchasesKit.jsx";
import {
  BackLink,
  ProductHistoryCard,
  ProductHistoryDayGroup,
  ProductHistoryPagination,
  ProductHistoryStyles,
} from "../salesPurchases/ProductHistoryKit.jsx";
import DispatcherHubMark from "./DispatcherHubMark.jsx";

// One product's purchases (from the Factory) and sales (to this dispatcher's
// dealers), laid out exactly like the dealer product history page. The
// movements come from the orders themselves (admin.service.js
// getDispatcherProductMovements), each carrying its full order for preview.

const HISTORY_DAYS_PAGE_SIZE = 6;

const VIEW_OPTIONS = [
  { key: "all", label: "Sales and Purchases" },
  { key: "purchases", label: "Purchases" },
  { key: "sales", label: "Sales" },
];

function buildProductHistoryEvents(movements) {
  return movements
    .map((movement, index) => ({
      type: movement.type === "SALE" ? "sale" : "order",
      key: `${movement.type}-${movement.order?._id || index}`,
      date: new Date(movement.createdAt),
      movement,
    }))
    .filter((event) => !Number.isNaN(event.date.getTime()))
    .sort((a, b) => b.date - a.date);
}

function statusPill(order) {
  const meta = orderStatusMeta(normalizeStatus(order?.status));
  return <Pill tone={meta.tone} size="small">{meta.label}</Pill>;
}

export default function AdminDispatcherProductHistoryPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { dispatcherId, productId, mode } = useMemo(() => {
    const match = location.pathname.match(
      /^\/admin\/dashboard\/dispatchers\/([^/]+)\/sales-purchases\/([^/]+)\/(purchases|sales|all)$/,
    );
    return { dispatcherId: match?.[1] || "", productId: match?.[2] || "", mode: match?.[3] || "all" };
  }, [location.pathname]);

  // "view" follows the URL; changeView() only navigates. Adjusting state
  // during render (not in an effect) catches every way the URL can change -
  // a tab click, or back/forward landing on another product or mode while
  // this page stays mounted.
  const [syncKey, setSyncKey] = useState(`${productId}:${mode}`);
  const [view, setView] = useState(mode);
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState(null);

  const urlKey = `${productId}:${mode}`;
  if (syncKey !== urlKey) {
    setSyncKey(urlKey);
    setView(mode);
    setPage(1);
  }

  const dispatcherQuery = useGetAdminDispatcherQuery(dispatcherId, { skip: !dispatcherId });
  const summaryQuery = useGetAdminDispatcherProductSummaryQuery({ dispatcherId }, { skip: !dispatcherId });
  const movementsQuery = useGetAdminDispatcherProductMovementsQuery(
    { dispatcherId, productId },
    { skip: !dispatcherId || !productId },
  );

  const dispatcher = dispatcherQuery.data?.item || null;
  const displayName = dispatcher?.name || dispatcher?.companyName || "Dispatcher";
  const product = useMemo(
    () => (summaryQuery.data?.items || []).find((item) => String(item.productId) === String(productId)) || null,
    [summaryQuery.data, productId],
  );

  const movements = useMemo(() => movementsQuery.data?.items || [], [movementsQuery.data]);
  const filteredMovements = useMemo(() => {
    if (view === "purchases") return movements.filter((movement) => movement.type === "PURCHASE");
    if (view === "sales") return movements.filter((movement) => movement.type === "SALE");
    return movements;
  }, [movements, view]);

  const dayGroups = useMemo(() => groupEventsByDay(buildProductHistoryEvents(filteredMovements)), [filteredMovements]);
  const totalPages = Math.max(1, Math.ceil(dayGroups.length / HISTORY_DAYS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleDayGroups = dayGroups.slice((currentPage - 1) * HISTORY_DAYS_PAGE_SIZE, currentPage * HISTORY_DAYS_PAGE_SIZE);

  function changeView(nextView) {
    // Carry the state across: a replace without it would forget how we got here.
    navigate(`/admin/dashboard/dispatchers/${dispatcherId}/sales-purchases/${productId}/${nextView}`, {
      replace: true,
      state: location.state,
    });
  }

  // Stepping back through history returns to the Sales & Purchases entry we
  // came from, which still remembers it was opened from the profile.
  function goBack() {
    if (location.state?.fromSalesPurchases) navigate(-1);
    else navigate(`/admin/dashboard/dispatchers/${dispatcherId}/sales-purchases`);
  }

  const movementsError = movementsQuery.error ? getQueryErrorMessage(movementsQuery.error, "Failed to load product history.") : "";
  const productLabel = product ? `${product.name}${product.pack?.label ? ` · ${product.pack.label}` : ""}` : "";

  const viewCopy = {
    all: { icon: "overview", title: "Sales and Purchases", empty: "No activity yet", emptySubtitle: "This dispatcher hasn't bought or sold this product yet." },
    purchases: { icon: "truck", title: "Purchases", empty: "No purchases yet", emptySubtitle: "This product hasn't been received from the Factory yet." },
    sales: { icon: "handshake", title: "Sales", empty: "No sales yet", emptySubtitle: "This dispatcher hasn't delivered this product to a dealer yet." },
  }[view];

  function renderEvent(event, style) {
    const { movement } = event;
    if (event.type === "order") {
      return (
        <ProductHistoryCard
          key={event.key}
          variant="order"
          icon="truck"
          kind="Purchase"
          title={movement.order?.orderNumber || "Unnamed Order"}
          sub={`${formatTime(movement.createdAt)} · From the Factory`}
          pill={statusPill(movement.order)}
          quantity={movement.quantity}
          onClick={() => movement.order && setPreview({ order: movement.order, party: "From the Factory" })}
          style={style}
        />
      );
    }
    const dealerName = movement.order?.dealerName || "Dealer";
    return (
      <ProductHistoryCard
        key={event.key}
        variant="sale"
        icon="checkSquare"
        kind="Sale"
        title={movement.order?.orderNumber || "Order"}
        sub={`${formatTime(movement.createdAt)} · To ${dealerName}`}
        pill={statusPill(movement.order)}
        quantity={movement.quantity}
        onClick={() => movement.order && setPreview({ order: movement.order, party: `To ${dealerName}` })}
        style={style}
      />
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <BackLink onClick={goBack}>Back to Sales &amp; Purchases</BackLink>

      <Surface padding={20} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <DispatcherHubMark label={displayName} size={44} />
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-ink, #1d1d1f)" }}>
                {displayName} · {viewCopy.title}
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
                  <ProductHistoryDayGroup key={group.key} group={group} animate renderEvent={renderEvent} />
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

      <HistoryOrderPreviewModal order={preview?.order || null} party={preview?.party || ""} onClose={() => setPreview(null)} />

      <ProductHistoryStyles />
    </div>
  );
}
