import { useMemo, useState } from "react";
import { useGetFactoryDealersQuery, useGetFactoryOrdersQuery, useIssueFactoryInvoiceMutation } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { EmptyState, GhostButton, ListRow, Pill, PrimaryButton, SearchField, SectionHeader, Surface } from "../../components/dashboard/DashboardUI.jsx";
import { AppleDateField, AppleDropdown } from "../../components/dashboard/ApplePickers.jsx";
import { downloadTaxInvoicePdf, money, statusTone, titleCaseLabel, todayKey } from "../factoryHelpers.js";
import FactoryInvoiceModal from "./FactoryInvoiceModal.jsx";

const STATUS_OPTIONS = [
  { key: "ALL", label: "All statuses" },
  { key: "VERIFIED", label: "Verified" },
  { key: "DISPATCHED", label: "Dispatched" },
  { key: "COMPLETED", label: "Completed" },
  { key: "REJECTED", label: "Rejected" },
];

export default function FactoryInvoicesPage() {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dealerFilter, setDealerFilter] = useState("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [invoiceOrderId, setInvoiceOrderId] = useState(null);
  const [issuingOrderId, setIssuingOrderId] = useState(null);
  const [issueError, setIssueError] = useState("");

  const ordersQuery = useGetFactoryOrdersQuery({
    stage: "ALL",
    q: query,
    limit: 100,
    dealerId: dealerFilter !== "ALL" ? dealerFilter : undefined,
  });
  const dealersQuery = useGetFactoryDealersQuery();
  const [issueInvoice] = useIssueFactoryInvoiceMutation();
  const allOrders = ordersQuery.data?.items || [];
  // Full verified-dealer directory (not just dealers on the current page of
  // orders) - same pattern as AdminOrdersPage's Dispatcher filter, which
  // populates from useGetVerifiedDispatchersQuery rather than deriving
  // options from the already-loaded list.
  const dealerOptions = useMemo(
    () => [
      { key: "ALL", label: "All Dealers" },
      ...(dealersQuery.data?.items || []).map((dealer) => ({
        key: dealer._id,
        label: dealer.companyName || dealer.contactName || "Dealer",
      })),
    ],
    [dealersQuery.data],
  );

  const orders = allOrders.filter((order) => {
    if (date && todayKey(order.createdAt) !== date) return false;
    if (status !== "ALL" && String(order.status || "").toUpperCase() !== status) return false;
    return true;
  });
  const loadError = ordersQuery.error
    ? getQueryErrorMessage(ordersQuery.error, "Failed to load orders.")
    : dealersQuery.error
      ? getQueryErrorMessage(dealersQuery.error, "Failed to load dealers.")
      : "";
  const hasFilters = Boolean(query || draftQuery || dealerFilter !== "ALL" || date || status !== "ALL");

  function clearFilters() {
    setDraftQuery("");
    setQuery("");
    setDealerFilter("ALL");
    setDate("");
    setStatus("ALL");
  }

  async function handleGenerateInvoice(order) {
    setIssueError("");
    setIssuingOrderId(order._id);
    try {
      const invoice = await issueInvoice(order._id).unwrap();
      downloadTaxInvoicePdf({ invoice, order });
    } catch (error) {
      setIssueError(getQueryErrorMessage(error, "Failed to generate invoice."));
    } finally {
      setIssuingOrderId(null);
    }
  }

  function handleDownloadInvoice(order) {
    downloadTaxInvoicePdf({
      invoice: { invoiceNumber: order.invoiceNumber, issuedAt: order.invoiceIssuedAt },
      order,
    });
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          icon="invoice"
          title="Factory Invoice Center"
          subtitle="Preview a proforma estimate for any order, or generate the official numbered tax invoice once an order is delivered."
          action={ordersQuery.isFetching ? <Pill tone="accent" size="small">Updating…</Pill> : null}
        />

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 300, flex: "1 1 220px" }}>
            <SearchField value={draftQuery} onChange={setDraftQuery} onSubmit={() => setQuery(draftQuery.trim())} placeholder="Search dealer, order…" />
          </div>
          <AppleDropdown
            icon="store"
            value={dealerFilter}
            options={dealerOptions}
            onChange={setDealerFilter}
            style={{ width: 210 }}
          />
          <GhostButton
            icon="filter"
            onClick={() => setFiltersOpen((value) => !value)}
            style={
              filtersOpen
                ? {
                    background: "var(--color-ink, #1d1d1f)",
                    color: "#fff",
                    borderColor: "var(--color-ink, #1d1d1f)",
                    boxShadow: "0 12px 26px rgba(29,29,31,.16)",
                  }
                : undefined
            }
          >
            Filters
          </GhostButton>
        </div>

        {filtersOpen ? (
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }} className="dash-fade-up">
            <AppleDateField value={date} onChange={setDate} />
            <AppleDropdown value={status} options={STATUS_OPTIONS} onChange={setStatus} style={{ width: 170 }} />
            {hasFilters ? <GhostButton onClick={clearFilters}>Clear</GhostButton> : null}
          </div>
        ) : null}

        {loadError || issueError ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {loadError || issueError}
          </div>
        ) : null}
      </Surface>

      {ordersQuery.isLoading && !ordersQuery.data ? (
        <Surface padding={18}>
          <div style={{ height: 240, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : orders.length === 0 ? (
        <EmptyState icon="invoice" title="No invoices available" />
      ) : (
        <Surface padding={0} className="dash-fade-up">
          {orders.map((order) => (
            <ListRow key={order._id}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{order.orderNumber}</div>
                <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{order.dealerSnapshot?.companyName || "Dealer"}</div>
              </div>
              <Pill tone={statusTone(order.status)} size="small">{titleCaseLabel(order.status)}</Pill>
              <strong style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)", flexShrink: 0 }}>{money(order.totals?.total, order.totals?.currency)}</strong>
              {order.invoiceNumber ? <Pill tone="positive" size="small">{order.invoiceNumber}</Pill> : null}
              <GhostButton icon="invoice" onClick={() => setInvoiceOrderId(order._id)}>Preview Proforma</GhostButton>
              {order.status === "COMPLETED" ? (
                order.invoiceNumber ? (
                  <GhostButton icon="download" onClick={() => handleDownloadInvoice(order)}>Download Invoice</GhostButton>
                ) : (
                  <PrimaryButton icon="invoice" disabled={issuingOrderId === order._id} onClick={() => handleGenerateInvoice(order)}>
                    {issuingOrderId === order._id ? "Generating…" : "Generate Invoice"}
                  </PrimaryButton>
                )
              ) : null}
            </ListRow>
          ))}
        </Surface>
      )}

      <FactoryInvoiceModal key={invoiceOrderId || "none"} orderId={invoiceOrderId} onClose={() => setInvoiceOrderId(null)} />
    </div>
  );
}
