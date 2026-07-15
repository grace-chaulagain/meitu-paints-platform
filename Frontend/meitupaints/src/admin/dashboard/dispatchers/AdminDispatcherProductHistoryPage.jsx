import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  useGetAdminDispatcherQuery,
  useGetAdminDispatcherProductSummaryQuery,
  useGetAdminDispatcherProductMovementsQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import {
  Avatar,
  DashboardUIStyles,
  EmptyState,
  Pill,
  SectionHeader,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";

function formatQty(value) {
  return Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function orderStatusTone(status) {
  if (status === "COMPLETED" || status === "DISPATCHED") return "positive";
  if (status === "REJECTED" || status === "CANCELLED") return "critical";
  return "accent";
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

function ModalShell({ children, onClose, width = 480 }) {
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

function MovementPreviewModal({ movement, onClose }) {
  if (!movement) return null;
  const isSale = movement.type === "SALE";

  return (
    <ModalShell onClose={onClose}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <SectionHeader
          eyebrow={movement.order?.orderNumber}
          icon={isSale ? "store" : "truck"}
          title={isSale ? movement.order?.dealerName || "Dealer" : "Replenishment Order"}
        />
        <CloseButton onClick={onClose} />
      </div>

      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
        <Pill tone={orderStatusTone(movement.order?.status)} size="small">{movement.order?.status}</Pill>
        <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{formatDate(movement.createdAt)}</span>
      </div>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "var(--color-fog, #f5f5f7)", fontSize: 13 }}>
        <span>{movement.packLabel || "Quantity"}</span>
        <span style={{ fontWeight: 700 }}>{formatQty(movement.quantity)}</span>
      </div>
    </ModalShell>
  );
}

export default function AdminDispatcherProductHistoryPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { dispatcherId, productId, mode } = useMemo(() => {
    const match = location.pathname.match(
      /^\/admin\/dashboard\/dispatchers\/([^/]+)\/sales-purchases\/([^/]+)\/(purchases|sales)$/,
    );
    return { dispatcherId: match?.[1] || "", productId: match?.[2] || "", mode: match?.[3] || "purchases" };
  }, [location.pathname]);

  const isSales = mode === "sales";

  const [previewMovement, setPreviewMovement] = useState(null);

  const dispatcherQuery = useGetAdminDispatcherQuery(dispatcherId, { skip: !dispatcherId });
  const summaryQuery = useGetAdminDispatcherProductSummaryQuery(dispatcherId, { skip: !dispatcherId });
  const movementsQuery = useGetAdminDispatcherProductMovementsQuery(
    { dispatcherId, productId },
    { skip: !dispatcherId || !productId },
  );

  const dispatcher = dispatcherQuery.data?.item || null;
  const product = useMemo(
    () => (summaryQuery.data?.items || []).find((item) => String(item.productId) === String(productId)) || null,
    [summaryQuery.data, productId],
  );

  const movements = useMemo(() => movementsQuery.data?.items || [], [movementsQuery.data]);
  const rows = useMemo(
    () => movements.filter((movement) => movement.type === (isSales ? "SALE" : "PURCHASE")),
    [movements, isSales],
  );

  const movementsError = movementsQuery.error ? getQueryErrorMessage(movementsQuery.error, "Failed to load product history.") : "";

  const productLabel = product ? `${product.name}${product.pack?.label ? ` · ${product.pack.label}` : ""}` : "";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <BackLink onClick={() => navigate(`/admin/dashboard/dispatchers/${dispatcherId}/sales-purchases`)}>Back to Sales &amp; Purchases</BackLink>

      <Surface padding={20} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar label={dispatcher?.name || dispatcher?.companyName || "D"} size={44} />
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-ink, #1d1d1f)" }}>
              {dispatcher?.name || dispatcher?.companyName || "Dispatcher"} · {isSales ? "Sales" : "Purchases"}
            </div>
            <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
              {productLabel || "Loading product…"}
            </div>
          </div>
        </div>
      </Surface>

      {movementsError ? (
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
          {movementsError}
        </div>
      ) : null}

      <Surface padding={26} className="dash-fade-up">
        <SectionHeader
          icon={isSales ? "store" : "truck"}
          title={isSales ? "Sales" : "Purchases"}
          subtitle={productLabel}
          action={movementsQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
        />

        <div style={{ marginTop: 16 }}>
          {movementsQuery.isLoading && !movementsQuery.data ? (
            <div style={{ height: 160, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={isSales ? "store" : "truck"}
              title={isSales ? "No sales yet" : "No purchases yet"}
              subtitle={
                isSales
                  ? "This dispatcher hasn't dispatched this product to a dealer yet."
                  : "This product hasn't been received from the Factory yet."
              }
            />
          ) : (
            <div className="admin-dph-history" style={{ borderRadius: 16, border: "1px solid rgba(0,0,0,.06)", overflow: "hidden" }}>
              <div className="admin-dph-row admin-dph-head">
                <span>Date</span>
                <span>{isSales ? "Order" : "Order"}</span>
                <span>{isSales ? "Dealer" : "Size"}</span>
                <span style={{ textAlign: "right" }}>Quantity</span>
              </div>
              {rows.map((movement, index) => (
                <div
                  key={`${movement.order?._id || index}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPreviewMovement(movement)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setPreviewMovement(movement);
                    }
                  }}
                  className="admin-dph-row admin-dph-clickable-row"
                >
                  <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>{formatDate(movement.createdAt)}</span>
                  <span style={{ fontSize: 13, fontWeight: 650, color: "var(--color-ink, #1d1d1f)" }}>{movement.order?.orderNumber || "—"}</span>
                  <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
                    {isSales ? (movement.order?.dealerName || "—") : (product?.pack?.label || "—")}
                  </span>
                  <span style={{ textAlign: "right", fontSize: 13.5, fontWeight: 600 }}>{formatQty(movement.quantity)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Surface>

      <MovementPreviewModal movement={previewMovement} onClose={() => setPreviewMovement(null)} />

      <style>{`
        .admin-dph-row{
          display:grid;
          grid-template-columns:110px minmax(0,1fr) minmax(0,1fr) 100px;
          gap:14px;
          align-items:center;
          padding:12px 18px;
        }
        .admin-dph-row + .admin-dph-row{
          border-top:1px solid rgba(0,0,0,.06);
        }
        .admin-dph-head{
          background:var(--color-fog, #f5f5f7);
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.06em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
        }
        .admin-dph-clickable-row{
          cursor:pointer;
          transition:background-color .12s ease;
        }
        .admin-dph-clickable-row:hover{
          background:rgba(0,113,227,.05);
        }
        @media (max-width:720px){
          .admin-dph-row{
            grid-template-columns:80px minmax(0,1fr) minmax(0,1fr) 70px;
            gap:8px;
            padding:10px 12px;
          }
        }
      `}</style>
    </div>
  );
}
