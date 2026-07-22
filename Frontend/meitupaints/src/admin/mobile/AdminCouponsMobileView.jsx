import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetAdminCouponBatchesQuery } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { LargeTitleHeader } from "../../dealer/mobile/LargeTitleHeader.jsx";
import { SkeletonSwap } from "../../dealer/mobile/SkeletonSwap.jsx";
import { SegmentedControl } from "../../dealer/mobile/SegmentedControl.jsx";
import { StatusChip } from "../../dealer/mobile/StatusChip.jsx";
import { rankBySearch } from "../../utils/searchMatch.js";
import { couponTypeLabel, formatDateTime, formatMoney } from "../dashboard/coupons/couponFormatting.js";

const SEGMENTS = [
  { key: "ALL", label: "All" },
  { key: "GOLDEN", label: "Golden" },
  { key: "STANDARD", label: "Standard" },
];

// Batches list + read-only redemption view is the mobile-worthy slice of
// this feature (see AdminCouponBatchDetailPage.jsx's own mobile branch) -
// Generate (print-ready QR/PDF card bureau), Catalog (reward-rule CRUD),
// Attempts (scan-audit log), and Settlement (dealer payouts) all stay
// desktop-only, documented cuts. Batch delete requires zero redemptions and
// is a rare cleanup action - kept desktop-only too, not reimplemented here.
export function AdminCouponsMobileView() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");

  const batchesQuery = useGetAdminCouponBatchesQuery({ type, page: 1, limit: 100 });
  const items = useMemo(() => batchesQuery.data?.items || [], [batchesQuery.data]);

  const visible = useMemo(() => rankBySearch(items, query, (batch) => [batch.productName, batch.batchId]), [items, query]);

  const loading = batchesQuery.isLoading && items.length === 0;
  const loadError = batchesQuery.error ? getQueryErrorMessage(batchesQuery.error, "Failed to load coupon batches.") : "";

  if (loadError) {
    return (
      <div className="dealer-m-orders">
        <div className="dealer-m-error-card">
          <div className="dealer-m-error-title">{loadError}</div>
          <button type="button" className="dealer-m-error-retry" onClick={() => batchesQuery.refetch()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dealer-m-orders">
      <SkeletonSwap
        loading={loading}
        skeleton={
          <>
            <div className="dealer-m-large-title">Coupons</div>
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 20, borderRadius: 20 }} />
            <div className="dealer-m-skel" style={{ height: 90, marginTop: 12, borderRadius: 20 }} />
          </>
        }
      >
        <LargeTitleHeader title="Coupons" contextLabel={`${visible.length} batches`} />

        <div style={{ marginTop: 6 }}>
          <input
            className="dealer-m-newsale-input"
            style={{ marginTop: 0 }}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search product, batch…"
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <SegmentedControl options={SEGMENTS} value={type} onChange={setType} />
        </div>

        {visible.length === 0 ? (
          <div className="dealer-m-empty">
            <DashboardIcon name="invoice" size={40} strokeWidth={1.4} className="dealer-m-empty-icon" />
            <div className="dealer-m-empty-title">No coupon batches found</div>
          </div>
        ) : (
          <div className="admin-m-card-list" style={{ marginTop: 16 }}>
            {visible.map((batch) => (
              <button
                key={batch.batchId}
                type="button"
                className="admin-m-card admin-m-feed-row"
                onClick={() => navigate(`/admin/dashboard/coupons/batches/${batch.batchId}`)}
              >
                <span className="admin-m-feed-icon">
                  <DashboardIcon name="invoice" size={16} strokeWidth={1.8} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="admin-m-feed-title">
                    {batch.productName}
                    {batch.bucketSize ? ` · ${batch.bucketSize}` : ""}
                  </span>
                  <span className="admin-m-feed-detail">
                    {batch.totalCount} coupons · {formatDateTime(batch.createdAt)}
                  </span>
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <StatusChip tone={batch.type === "GOLDEN" ? "caution" : "positive"}>{couponTypeLabel(batch.type)}</StatusChip>
                  <span style={{ fontSize: 11, color: "var(--color-graphite, #707070)" }}>{formatMoney(batch.totalCashAmount)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </SkeletonSwap>
    </div>
  );
}
