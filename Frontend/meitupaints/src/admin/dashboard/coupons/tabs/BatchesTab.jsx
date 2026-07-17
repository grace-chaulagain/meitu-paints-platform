import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  useDeleteCouponBatchesMutation,
  useDeleteCouponBatchMutation,
  useGetAdminCouponBatchesQuery,
} from "../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../redux/api/selectors.js";
import { DashboardIcon } from "../../../../components/dashboard/DashboardIcons.jsx";
import {
  BulkActionBar,
  DataTable,
  GhostButton,
  Pagination,
  Pill,
  SearchField,
  Surface,
} from "../../../../components/dashboard/DashboardUI.jsx";
import { AppleDropdown } from "../../../../components/dashboard/ApplePickers.jsx";
import ConfirmActionModal from "../../../catalog/components/ConfirmActionModal.jsx";
import { couponTypeLabel, formatDateTime, formatMoney, HISTORY_TYPE_OPTIONS, PAGE_SIZE } from "../couponFormatting.js";

export default function BatchesTab({ onToast }) {
  const navigate = useNavigate();
  const [type, setType] = useState("ALL");
  const [q, setQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [page, setPage] = useState(1);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState([]);
  const [deleteBatchTarget, setDeleteBatchTarget] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const batchesQuery = useGetAdminCouponBatchesQuery({ type, q, page, limit: PAGE_SIZE });
  const [deleteCouponBatch, deleteBatchState] = useDeleteCouponBatchMutation();
  const [deleteCouponBatches, bulkDeleteState] = useDeleteCouponBatchesMutation();

  const items = useMemo(() => batchesQuery.data?.items || [], [batchesQuery.data]);
  const pagination = batchesQuery.data?.pagination || { page: 1, pages: 1, total: 0 };
  const loadError = batchesQuery.error ? getQueryErrorMessage(batchesQuery.error, "Failed to load coupon batches.") : "";

  function changeType(next) {
    setType(next);
    setPage(1);
  }
  function submitSearch() {
    setQ(draftQ.trim());
    setPage(1);
  }
  function toggleSelect(batchId) {
    setSelectedBatchIds((prev) => (prev.includes(batchId) ? prev.filter((id) => id !== batchId) : [...prev, batchId]));
  }
  function toggleSelectAllOnPage() {
    const pageIds = items.map((batch) => batch.batchId);
    const allSelected = pageIds.every((id) => selectedBatchIds.includes(id));
    setSelectedBatchIds((prev) =>
      allSelected ? prev.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...prev, ...pageIds])),
    );
  }
  function toggleSelectMode() {
    setSelectMode((prev) => {
      const next = !prev;
      if (!next) setSelectedBatchIds([]);
      return next;
    });
  }

  async function handleDeleteBatch() {
    try {
      await deleteCouponBatch(deleteBatchTarget.batchId).unwrap();
      onToast({ tone: "success", title: "Batch deleted", description: `${deleteBatchTarget.productName} (${deleteBatchTarget.totalCount} coupons) was permanently removed.` });
      setDeleteBatchTarget(null);
    } catch (err) {
      setDeleteBatchTarget(null);
      onToast({ tone: "error", title: "Could not delete batch", description: getQueryErrorMessage(err, "This batch may contain redeemed coupons.") });
    }
  }

  async function handleBulkDelete() {
    try {
      const result = await deleteCouponBatches(selectedBatchIds).unwrap();
      setSelectedBatchIds([]);
      setConfirmBulkDelete(false);
      const deletedCount = result.deletedBatchIds?.length || 0;
      const skippedCount = result.skippedBatchIds?.length || 0;
      onToast({
        tone: skippedCount ? "caution" : "success",
        title: `${deletedCount} batch${deletedCount === 1 ? "" : "es"} deleted`,
        description: skippedCount ? `${skippedCount} skipped - contains redeemed coupons.` : "Permanently removed from the database.",
      });
    } catch (err) {
      setConfirmBulkDelete(false);
      onToast({ tone: "error", title: "Could not delete batches", description: getQueryErrorMessage(err, "Failed to delete batches.") });
    }
  }

  const columns = useMemo(
    () => [
      {
        key: "batch",
        header: "Batch",
        width: "26%",
        render: (batch) => (
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 30,
                height: 30,
                flexShrink: 0,
                borderRadius: 9,
                display: "grid",
                placeItems: "center",
                background: "var(--color-fog,#f5f5f7)",
                color: "var(--color-graphite,#707070)",
              }}
            >
              <DashboardIcon name="invoice" size={14} strokeWidth={1.7} />
            </span>
            <span style={{ fontWeight: 700 }}>
              {batch.productName}
              {batch.bucketSize ? ` · ${batch.bucketSize}` : ""}
            </span>
          </span>
        ),
      },
      {
        key: "type",
        header: "Type",
        render: (batch) => <Pill tone={batch.type === "GOLDEN" ? "caution" : "positive"} size="small">{couponTypeLabel(batch.type)}</Pill>,
      },
      {
        key: "createdAt",
        header: "Created",
        render: (batch) => <span style={{ color: "var(--color-graphite,#707070)", whiteSpace: "nowrap" }}>{formatDateTime(batch.createdAt)}</span>,
      },
      {
        key: "totalCount",
        header: "Coupons",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (batch) => batch.totalCount,
      },
      {
        key: "status",
        header: "Status",
        render: (batch) => (
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {batch.unusedCount > 0 ? <Pill tone="positive" size="small">{batch.unusedCount} unused</Pill> : null}
            {batch.redeemedCount > 0 ? <Pill tone="neutral" size="small">{batch.redeemedCount} redeemed</Pill> : null}
          </span>
        ),
      },
      {
        key: "totalCashAmount",
        header: "Cash liability",
        align: "right",
        cellClassName: () => "dash-table-tabular",
        render: (batch) => <span style={{ fontWeight: 700, color: "var(--color-azure,#0071e3)" }}>{formatMoney(batch.totalCashAmount)}</span>,
      },
      ...(selectMode
        ? []
        : [
            {
              key: "actions",
              header: "",
              align: "right",
              width: 56,
              render: (batch) => (
                <button
                  type="button"
                  className="coupon-batch-icon-btn"
                  title={batch.hasRedemptions ? "Contains redeemed coupons - cannot delete" : "Delete batch"}
                  disabled={batch.hasRedemptions}
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteBatchTarget(batch);
                  }}
                >
                  <DashboardIcon name={batch.hasRedemptions ? "lock" : "trash"} size={15} strokeWidth={1.8} />
                </button>
              ),
            },
          ]),
    ],
    [selectMode],
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={16}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <AppleDropdown value={type} options={HISTORY_TYPE_OPTIONS} onChange={changeType} style={{ width: 160 }} />
          <SearchField value={draftQ} onChange={setDraftQ} onSubmit={submitSearch} placeholder="Search product name…" style={{ maxWidth: 240 }} />
          <GhostButton icon={selectMode ? "close" : "checkSquare"} onClick={toggleSelectMode}>
            {selectMode ? "Cancel" : "Select"}
          </GhostButton>
          {batchesQuery.isFetching ? (
            <Pill tone="accent" size="small">
              Updating…
            </Pill>
          ) : null}
        </div>
      </Surface>

      <BulkActionBar count={selectedBatchIds.length} onClear={() => setSelectedBatchIds([])}>
        <button type="button" className="coupon-batch-bulk-delete-btn" title="Delete selected batches" onClick={() => setConfirmBulkDelete(true)}>
          <DashboardIcon name="trash" size={14} strokeWidth={2} />
        </button>
      </BulkActionBar>

      {loadError ? (
        <div className="admin-coupons-error">{loadError}</div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={items}
            getRowKey={(batch) => batch.batchId}
            loading={batchesQuery.isLoading && !batchesQuery.data}
            onRowClick={(batch) => navigate(`/admin/dashboard/coupons/batches/${batch.batchId}`)}
            selection={
              selectMode
                ? { selectedIds: selectedBatchIds, onToggleSelect: toggleSelect, onToggleAll: toggleSelectAllOnPage }
                : null
            }
            emptyState={{ icon: "invoice", title: "No coupon batches found", subtitle: "Generate a batch to see it appear here." }}
            minWidth={780}
          />
          <Pagination page={pagination.page} totalPages={pagination.pages} totalCount={pagination.total} itemLabel="batches" onChange={setPage} />
        </>
      )}

      <ConfirmActionModal
        open={Boolean(deleteBatchTarget)}
        title="Delete entire batch?"
        description={`This permanently removes all ${deleteBatchTarget?.totalCount || 0} coupons in "${deleteBatchTarget?.productName || ""}" from the database. This cannot be undone.`}
        confirmText="Delete"
        danger
        loading={deleteBatchState.isLoading}
        onClose={() => setDeleteBatchTarget(null)}
        onConfirm={handleDeleteBatch}
      />

      <ConfirmActionModal
        open={confirmBulkDelete}
        title={`Delete ${selectedBatchIds.length} batch${selectedBatchIds.length === 1 ? "" : "es"}?`}
        description="Batches containing any redeemed coupon are skipped automatically. This cannot be undone for the rest."
        confirmText="Delete"
        danger
        loading={bulkDeleteState.isLoading}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={handleBulkDelete}
      />

      <style>{`
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
        .coupon-batch-icon-btn:focus-visible{
          outline:none;
          box-shadow:0 0 0 3px rgba(0,113,227,.18);
        }
        .coupon-batch-bulk-delete-btn{
          width:30px;
          height:30px;
          border:none;
          border-radius:9px;
          display:grid;
          place-items:center;
          background:rgba(180,35,24,.1);
          color:#b42318;
          cursor:pointer;
          transition:transform .14s var(--ease-out, ease), background .14s ease;
        }
        .coupon-batch-bulk-delete-btn:hover{
          background:rgba(180,35,24,.16);
        }
        .coupon-batch-bulk-delete-btn:active{
          transform:scale(.92);
        }
        .coupon-batch-bulk-delete-btn:focus-visible{
          outline:none;
          box-shadow:0 0 0 3px rgba(0,113,227,.18);
        }
        @media (prefers-reduced-motion: reduce){
          .coupon-batch-icon-btn,
          .coupon-batch-bulk-delete-btn{ transition:none!important; }
        }
      `}</style>
    </div>
  );
}
