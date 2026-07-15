import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  useDeleteCouponBatchMutation,
  useDeleteCouponMutation,
  useGetAdminCouponsQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { EmptyState, Pill, SectionHeader, Surface } from "../../../components/dashboard/DashboardUI.jsx";
import { Toast } from "../../../components/dashboard/Toast.jsx";
import ConfirmActionModal from "../../catalog/components/ConfirmActionModal.jsx";

function couponTypeLabel(type) {
  return type === "GOLDEN" ? "Golden Coupon" : "Green Coupon";
}

function couponStatusTone(status) {
  if (status === "REDEEMED") return "positive";
  if (status === "EXPIRED") return "caution";
  return "neutral";
}

function formatMoney(value) {
  return `NPR ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

// Full page (not a modal) for one generate-batch's coupons, reached by
// clicking a batch card in CouponsTab - same "list drills into its own
// page" convention as AdminPainterProfilePage.jsx/AdminDealerProfilePage.jsx.
// No QR image here: the raw redeem token is never persisted (only its
// hash), by design, so a past batch can only ever show coupon data, not a
// re-scannable code.
export default function AdminCouponBatchDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [toast, setToast] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmDeleteBatch, setConfirmDeleteBatch] = useState(false);

  const batchId = useMemo(() => {
    const match = location.pathname.match(/^\/admin\/dashboard\/coupons\/batches\/([^/]+)$/);
    return match?.[1] || "";
  }, [location.pathname]);

  const detailQuery = useGetAdminCouponsQuery({ batchId, limit: 5000 }, { skip: !batchId });
  const [deleteCoupon, deleteCouponState] = useDeleteCouponMutation();
  const [deleteCouponBatch, deleteBatchState] = useDeleteCouponBatchMutation();

  const items = useMemo(() => detailQuery.data?.items || [], [detailQuery.data]);
  const loadError = detailQuery.error ? getQueryErrorMessage(detailQuery.error, "Failed to load this batch's coupons.") : "";

  // There's no dedicated "get one batch" endpoint - the summary (product,
  // type, counts, cash total) is derived from the coupon list itself, which
  // the page already has to fetch to show the table.
  const summary = useMemo(() => {
    if (!items.length) return null;
    const first = items[0];
    const redeemedCount = items.filter((coupon) => coupon.status === "REDEEMED").length;
    const totalCashAmount = items.reduce((sum, coupon) => sum + Number(coupon.cashAmount || 0), 0);
    const createdAt = items.reduce((min, coupon) => (!min || new Date(coupon.createdAt) < new Date(min) ? coupon.createdAt : min), null);
    return {
      productName: first.productName || "Coupon batch",
      bucketSize: first.bucketSize || "",
      type: first.type,
      createdAt,
      totalCount: items.length,
      redeemedCount,
      unusedCount: items.length - redeemedCount,
      totalCashAmount,
      hasRedemptions: redeemedCount > 0,
    };
  }, [items]);

  const backButton = (
    <div className="coupon-batch-breadcrumb">
      <button type="button" className="coupon-batch-back-btn" onClick={() => navigate("/admin/dashboard/coupons")} aria-label="Back to coupons">
        <DashboardIcon name="chevron" size={14} strokeWidth={2.2} style={{ transform: "rotate(180deg)" }} />
      </button>
      <button type="button" className="coupon-batch-crumb-link" onClick={() => navigate("/admin/dashboard/coupons")}>
        Coupons
      </button>
      <DashboardIcon name="chevron" size={12} strokeWidth={2.2} style={{ color: "var(--color-graphite,#707070)" }} />
      <span className="coupon-batch-crumb-current">Batch</span>
    </div>
  );

  async function handleDeleteCoupon() {
    try {
      await deleteCoupon(deleteTarget._id).unwrap();
      setToast({ tone: "success", title: "Coupon deleted", description: `${deleteTarget.couponCode} was permanently removed.` });
      setDeleteTarget(null);
    } catch (err) {
      setToast({ tone: "error", title: "Could not delete coupon", description: getQueryErrorMessage(err, "Failed to delete coupon.") });
      setDeleteTarget(null);
    }
  }

  async function handleDeleteBatch() {
    try {
      await deleteCouponBatch(batchId).unwrap();
      setConfirmDeleteBatch(false);
      navigate("/admin/dashboard/coupons");
    } catch (err) {
      setConfirmDeleteBatch(false);
      setToast({ tone: "error", title: "Could not delete batch", description: getQueryErrorMessage(err, "Failed to delete batch.") });
    }
  }

  if (detailQuery.isLoading) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        {backButton}
        <Surface padding={18}>
          <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      </div>
    );
  }

  if (loadError || !summary) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        {backButton}
        <EmptyState icon="invoice" title="Batch not found" subtitle={loadError || "This batch may have been deleted."} />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {backButton}

      <Surface padding={22} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <SectionHeader
            icon="invoice"
            size="large"
            title={`${summary.productName}${summary.bucketSize ? ` · ${summary.bucketSize}` : ""}`}
            subtitle={`${formatDateTime(summary.createdAt)} · ${summary.totalCount} coupon${summary.totalCount === 1 ? "" : "s"} · ${formatMoney(summary.totalCashAmount)} total`}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Pill tone={summary.type === "GOLDEN" ? "caution" : "positive"} size="small">{couponTypeLabel(summary.type)}</Pill>
            <button
              type="button"
              className="coupon-batch-icon-btn"
              title={summary.hasRedemptions ? "Contains redeemed coupons - cannot delete" : "Delete entire batch"}
              disabled={summary.hasRedemptions}
              onClick={() => setConfirmDeleteBatch(true)}
            >
              <DashboardIcon name={summary.hasRedemptions ? "lock" : "trash"} size={15} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </Surface>

      <Surface padding={0}>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-coupons-table" style={{ minWidth: 620 }}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Status</th>
                <th className="align-right">Points</th>
                <th className="align-right">Cash</th>
                <th>Expires</th>
                <th>Redeemed By</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((coupon) => {
                const displayStatus = coupon.isExpired && coupon.status === "UNUSED" ? "EXPIRED" : coupon.status;
                return (
                  <tr key={coupon._id}>
                    <td className="admin-coupons-mono">{coupon.couponCode}</td>
                    <td>
                      <Pill tone={couponStatusTone(displayStatus)} size="small">{displayStatus}</Pill>
                    </td>
                    <td className="align-right admin-coupons-tabular">{coupon.points}</td>
                    <td className="align-right admin-coupons-tabular" style={{ fontWeight: 700 }}>{formatMoney(coupon.cashAmount)}</td>
                    <td style={{ whiteSpace: "nowrap", color: "var(--color-graphite, #707070)" }}>{formatDateTime(coupon.expiresAt)}</td>
                    <td>{coupon.redeemedByDealerId?.companyName || "—"}</td>
                    <td>
                      {coupon.status === "REDEEMED" ? (
                        <span style={{ fontSize: 12, color: "var(--color-graphite, #707070)" }}>—</span>
                      ) : (
                        <button
                          type="button"
                          className="coupon-batch-icon-btn"
                          style={{ width: 28, height: 28 }}
                          title="Delete coupon"
                          onClick={() => setDeleteTarget(coupon)}
                        >
                          <DashboardIcon name="trash" size={13} strokeWidth={1.8} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Surface>

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Delete this coupon?"
        description={`${deleteTarget?.couponCode || "This coupon"} will be permanently removed from the database. This cannot be undone.`}
        confirmText="Delete"
        danger
        loading={deleteCouponState.isLoading}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteCoupon}
      />

      <ConfirmActionModal
        open={confirmDeleteBatch}
        title="Delete entire batch?"
        description={`This permanently removes all ${summary.totalCount} coupons in this batch from the database. This cannot be undone.`}
        confirmText="Delete"
        danger
        loading={deleteBatchState.isLoading}
        onClose={() => setConfirmDeleteBatch(false)}
        onConfirm={handleDeleteBatch}
      />

      <style>{`
        .coupon-batch-breadcrumb{
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }
        .coupon-batch-back-btn{
          width:32px;
          height:32px;
          flex:0 0 auto;
          border:1px solid rgba(29,29,31,.1);
          border-radius:10px;
          background:#fff;
          color:var(--color-graphite,#707070);
          display:grid;
          place-items:center;
          cursor:pointer;
          transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease);
        }
        .coupon-batch-back-btn:hover{
          background:var(--color-fog,#f5f5f7);
          color:var(--color-ink,#1d1d1f);
        }
        .coupon-batch-back-btn:active{
          transform:scale(.92);
        }
        .coupon-batch-crumb-link{
          border:0;
          background:transparent;
          padding:0;
          font-size:13.5px;
          font-weight:600;
          color:var(--color-graphite,#707070);
          cursor:pointer;
        }
        .coupon-batch-crumb-link:hover{
          color:var(--color-ink,#1d1d1f);
        }
        .coupon-batch-crumb-current{
          font-size:13.5px;
          font-weight:700;
          color:var(--color-ink,#1d1d1f);
        }
        .coupon-batch-icon-btn{
          width:32px;
          height:32px;
          flex-shrink:0;
          border:none;
          border-radius:9px;
          display:grid;
          place-items:center;
          background:var(--color-fog, #f5f5f7);
          color:var(--color-graphite, #707070);
          cursor:pointer;
          transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease), opacity .14s ease;
        }
        .coupon-batch-icon-btn:hover:not(:disabled){
          background:rgba(180,35,24,.1);
          color:#b42318;
        }
        .coupon-batch-icon-btn:active:not(:disabled){
          transform:scale(.92);
        }
        .coupon-batch-icon-btn:disabled{
          opacity:.4;
          cursor:not-allowed;
        }
        .admin-coupons-mono{
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-weight:700;
          letter-spacing:-.01em;
        }
        .admin-coupons-tabular{
          font-variant-numeric: tabular-nums;
        }
        .admin-coupons-table{
          width:100%;
          border-collapse:collapse;
        }
        .admin-coupons-table thead tr{
          background:var(--color-fog, #f5f5f7);
        }
        .admin-coupons-table th{
          text-align:left;
          padding:12px 18px;
          font-size:10.5px;
          font-weight:700;
          letter-spacing:.05em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
          white-space:nowrap;
        }
        .admin-coupons-table th.align-right,
        .admin-coupons-table td.align-right{
          text-align:right;
        }
        .admin-coupons-table td{
          padding:13px 18px;
          font-size:13px;
          border-top:1px solid rgba(0,0,0,.05);
          color:var(--color-ink, #1d1d1f);
        }
        .admin-coupons-table tbody tr{
          transition:background .12s ease;
        }
        .admin-coupons-table tbody tr:hover{
          background:rgba(0,113,227,.035);
        }
        @media (prefers-reduced-motion: reduce){
          .coupon-batch-back-btn,
          .coupon-batch-icon-btn{
            transition:none!important;
          }
        }
      `}</style>
    </div>
  );
}
