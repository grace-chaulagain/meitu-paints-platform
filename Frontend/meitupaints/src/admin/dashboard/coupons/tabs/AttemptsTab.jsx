import { useMemo, useState } from "react";

import { useGetCouponAttemptsQuery } from "../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../redux/api/selectors.js";
import { DataTable, Pagination, Pill, Surface } from "../../../../components/dashboard/DashboardUI.jsx";
import { AppleDropdown } from "../../../../components/dashboard/ApplePickers.jsx";
import { formatDateTime, OUTCOME_OPTIONS, outcomeTone, PAGE_SIZE } from "../couponFormatting.js";

export default function AttemptsTab() {
  const [outcome, setOutcome] = useState("ALL");
  const [page, setPage] = useState(1);

  const attemptsQuery = useGetCouponAttemptsQuery({ outcome, page, limit: PAGE_SIZE });
  const items = useMemo(() => attemptsQuery.data?.items || [], [attemptsQuery.data]);
  const pagination = attemptsQuery.data?.pagination || { page: 1, pages: 1, total: 0 };
  const loadError = attemptsQuery.error ? getQueryErrorMessage(attemptsQuery.error, "Failed to load attempt log.") : "";

  function changeOutcome(next) {
    setOutcome(next);
    setPage(1);
  }

  const columns = useMemo(
    () => [
      {
        key: "createdAt",
        header: "Time",
        render: (row) => <span style={{ color: "var(--color-graphite,#707070)", whiteSpace: "nowrap" }}>{formatDateTime(row.createdAt)}</span>,
      },
      {
        key: "outcome",
        header: "Outcome",
        render: (row) => <Pill tone={outcomeTone(row.outcome)} size="small">{row.outcome.replaceAll("_", " ")}</Pill>,
      },
      { key: "coupon", header: "Coupon", cellClassName: () => "dash-table-mono", render: (row) => row.couponId?.couponCode || "—" },
      { key: "dealer", header: "Dealer", render: (row) => row.dealerId?.companyName || "—" },
      {
        key: "user",
        header: "User",
        render: (row) => <span style={{ color: "var(--color-graphite,#707070)" }}>{row.userId?.username || row.userId?.email || "—"}</span>,
      },
    ],
    [],
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={16}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <AppleDropdown value={outcome} options={OUTCOME_OPTIONS} onChange={changeOutcome} style={{ width: 200 }} />
          {attemptsQuery.isFetching ? (
            <Pill tone="accent" size="small">
              Updating…
            </Pill>
          ) : null}
        </div>
      </Surface>

      {loadError ? (
        <div className="admin-coupons-error">{loadError}</div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={items}
            getRowKey={(row) => row._id}
            loading={attemptsQuery.isLoading && !attemptsQuery.data}
            emptyState={{ icon: "shield", title: "No attempts found", subtitle: "Nothing matches these filters yet." }}
            minWidth={760}
          />
          <Pagination page={pagination.page} totalPages={pagination.pages} totalCount={pagination.total} itemLabel="attempts" onChange={setPage} />
        </>
      )}
    </div>
  );
}
