import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useGetAdminDealerApplicationsQuery,
  useGetAdminDispatcherApplicationsQuery,
} from "../../../redux/api/meituApi.js";

const FILTERS = [
  { key: "ALL", label: "All Applications" },
  { key: "PENDING", label: "Pending Review" },
  { key: "VERIFIED", label: "Recently Approved" },
  { key: "REJECTED", label: "Recently Rejected" },
  { key: "DEALER", label: "Dealer Applications" },
  { key: "DISPATCHER", label: "Dispatcher Applications" },
];

function GlassCard({ children, style = {}, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        borderRadius: 16,
        border: "1px solid rgba(15,23,42,.08)",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle, action = null }) {
  return (
    <div className="applications-header">
      <div>
        <div className="applications-title">{title}</div>
        {subtitle ? <div className="applications-subtitle">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  );
}

function FilterButton({ active, children, onClick, count }) {
  return (
    <button
      type="button"
      className={`applications-filter ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span>{children}</span>
      {typeof count === "number" ? <b>{count}</b> : null}
    </button>
  );
}

function StatusBadge({ status }) {
  const normalized = String(status || "PENDING").toUpperCase();
  const tone =
    normalized === "VERIFIED"
      ? "approved"
      : normalized === "REJECTED"
        ? "rejected"
        : "pending";
  const label = normalized === "VERIFIED" ? "APPROVED" : normalized;
  return <span className={`applications-status ${tone}`}>{label}</span>;
}

function formatDate(value) {
  if (!value) return "No timestamp";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatType(type) {
  return type === "DISPATCHER" ? "Dispatcher" : "Dealer";
}

function normalizeApplication(item, type) {
  const status = String(item.status || "PENDING").toUpperCase();
  return {
    ...item,
    type,
    normalizedStatus: status,
    title:
      type === "DISPATCHER"
        ? item.companyName || item.name || "Dispatcher Application"
        : item.companyName || "Dealer Application",
    contactName: type === "DISPATCHER" ? item.name : item.contactName,
    submittedAt: item.createdAt,
    reviewNote: item.reviewNote || item.notes || "",
  };
}

function ApplicationCard({ item, onOpen }) {
  return (
    <GlassCard style={{ background: "#fff" }}>
      <button type="button" className="applications-card" onClick={onOpen}>
        <span className="applications-card-main">
          <span className="applications-card-top">
            <strong>{item.title}</strong>
            <StatusBadge status={item.normalizedStatus} />
          </span>
          <span className="applications-card-meta">
            {formatType(item.type)} application
            {item.contactName ? ` · ${item.contactName}` : ""}
          </span>
          <span className="applications-card-meta">
            {item.email || "No email"} · {item.phone || "No phone"}
          </span>
          {item.reviewNote ? (
            <span className="applications-review">{item.reviewNote}</span>
          ) : null}
        </span>
        <span className="applications-card-side">
          <span>{formatDate(item.submittedAt)}</span>
          <em>Open review</em>
        </span>
      </button>
    </GlassCard>
  );
}

export default function AdminApplicationsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("ALL");
  const dealerApplicationsQuery = useGetAdminDealerApplicationsQuery({ limit: 100 });
  const dispatcherApplicationsQuery = useGetAdminDispatcherApplicationsQuery({
    limit: 100,
  });

  const items = useMemo(() => {
    const dealerItems = (dealerApplicationsQuery.data?.items || []).map((item) =>
      normalizeApplication(item, "DEALER"),
    );
    const dispatcherItems = (
      dispatcherApplicationsQuery.data?.items || []
    ).map((item) => normalizeApplication(item, "DISPATCHER"));

    return [...dealerItems, ...dispatcherItems].sort(
      (a, b) =>
        new Date(b.submittedAt || 0).getTime() -
        new Date(a.submittedAt || 0).getTime(),
    );
  }, [dealerApplicationsQuery.data, dispatcherApplicationsQuery.data]);

  const loading =
    items.length === 0 &&
    (dealerApplicationsQuery.isLoading || dispatcherApplicationsQuery.isLoading);
  const refreshing =
    items.length > 0 &&
    (dealerApplicationsQuery.isFetching || dispatcherApplicationsQuery.isFetching);
  const error =
    dealerApplicationsQuery.error?.message ||
    dispatcherApplicationsQuery.error?.message ||
    "";

  function loadData() {
    dealerApplicationsQuery.refetch();
    dispatcherApplicationsQuery.refetch();
  }

  const counts = useMemo(() => {
    return {
      ALL: items.length,
      PENDING: items.filter((item) => item.normalizedStatus === "PENDING").length,
      VERIFIED: items.filter((item) => item.normalizedStatus === "VERIFIED")
        .length,
      REJECTED: items.filter((item) => item.normalizedStatus === "REJECTED")
        .length,
      DEALER: items.filter((item) => item.type === "DEALER").length,
      DISPATCHER: items.filter((item) => item.type === "DISPATCHER").length,
    };
  }, [items]);

  const visibleItems = useMemo(() => {
    if (filter === "ALL") return items;
    if (filter === "DEALER" || filter === "DISPATCHER") {
      return items.filter((item) => item.type === filter);
    }
    return items.filter((item) => item.normalizedStatus === filter);
  }, [filter, items]);

  function openWorkspace(item) {
    if (item.type === "DISPATCHER") {
      navigate("/admin/dashboard/applications/dispatchers");
      return;
    }
    navigate("/admin/dashboard/applications/dealers");
  }

  return (
    <div className="applications-page">
      <GlassCard style={{ padding: 18 }}>
        <SectionHeader
          title="Applications"
          subtitle="Unified intake for dealer and dispatcher applications, with deep review handled in the focused workspaces."
          action={
            <button type="button" className="applications-refresh" onClick={loadData}>
              {refreshing ? "Updating..." : "Refresh"}
            </button>
          }
        />

        <div className="applications-filters">
          {FILTERS.map((option) => (
            <FilterButton
              key={option.key}
              active={filter === option.key}
              count={counts[option.key]}
              onClick={() => setFilter(option.key)}
            >
              {option.label}
            </FilterButton>
          ))}
        </div>

        {error ? <div className="applications-error">{error}</div> : null}
      </GlassCard>

      <div className="applications-actions">
        <button
          type="button"
          onClick={() => navigate("/admin/dashboard/applications/dealers")}
        >
          Open Dealer Review
        </button>
        <button
          type="button"
          onClick={() => navigate("/admin/dashboard/applications/dispatchers")}
        >
          Open Dispatcher Review
        </button>
      </div>

      {loading ? (
        <div className="applications-list">
          {Array.from({ length: 5 }).map((_, index) => (
            <GlassCard key={index} style={{ padding: 18 }}>
              <div className="applications-skeleton" />
            </GlassCard>
          ))}
        </div>
      ) : visibleItems.length ? (
        <div className="applications-list">
          {visibleItems.map((item) => (
            <ApplicationCard
              key={`${item.type}-${item._id}`}
              item={item}
              onOpen={() => openWorkspace(item)}
            />
          ))}
        </div>
      ) : (
        <GlassCard style={{ padding: 26 }}>
          <div className="applications-empty-title">No applications found</div>
          <div className="applications-empty-copy">
            This view has no matching dealer or dispatcher applications.
          </div>
        </GlassCard>
      )}

      <style>{`
        .applications-page{ display:grid; gap:18px; margin-top:0; padding-top:0; align-content:start; }
        .applications-header{ display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; }
        .applications-title{ font-size:28px; font-weight:950; letter-spacing:-.03em; color:#0f172a; }
        .applications-subtitle{ margin-top:6px; max-width:760px; font-size:14px; line-height:1.65; font-weight:700; color:rgba(15,23,42,.58); }
        .applications-refresh,
        .applications-actions button{ min-height:40px; padding:9px 14px; border-radius:14px; border:1px solid rgba(15,23,42,.08); background:#fff; color:#0f172a; font-weight:900; cursor:pointer; }
        .applications-filters{ margin-top:18px; display:flex; gap:8px; flex-wrap:wrap; }
        .applications-filter{ min-height:38px; padding:8px 12px; border-radius:999px; border:1px solid rgba(15,23,42,.08); background:#fff; color:#0f172a; font-size:12px; font-weight:900; cursor:pointer; display:inline-flex; gap:8px; align-items:center; }
        .applications-filter.active{ border-color:rgba(180,35,24,.18); background:linear-gradient(135deg, #b91c1c 0%, #dd5127 100%); color:#fff; }
        .applications-filter b{ min-width:20px; height:20px; padding:0 6px; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; background:rgba(15,23,42,.06); font-size:10px; }
        .applications-filter.active b{ background:rgba(255,255,255,.18); }
        .applications-error{ margin-top:14px; padding:13px 15px; border-radius:16px; background:rgba(180,35,24,.08); color:#b42318; border:1px solid rgba(180,35,24,.14); font-weight:800; }
        .applications-actions{ display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap; }
        .applications-list{ display:grid; gap:12px; }
        .applications-card{ width:100%; border:0; background:transparent; padding:17px 18px; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:16px; text-align:left; cursor:pointer; }
        .applications-card-main{ min-width:0; display:grid; gap:7px; }
        .applications-card-top{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .applications-card-top strong{ color:#0f172a; font-size:16px; font-weight:950; letter-spacing:-.02em; }
        .applications-card-meta{ color:rgba(15,23,42,.58); font-size:13px; line-height:1.5; font-weight:700; }
        .applications-review{ width:max-content; max-width:100%; border-radius:999px; padding:6px 10px; background:rgba(15,23,42,.05); color:rgba(15,23,42,.58); font-size:12px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .applications-card-side{ display:grid; justify-items:end; gap:8px; color:rgba(15,23,42,.48); font-size:12px; font-weight:800; }
        .applications-card-side em{ color:#b42318; font-style:normal; font-weight:950; }
        .applications-status{ height:28px; padding:0 10px; border-radius:999px; display:inline-flex; align-items:center; font-size:11px; font-weight:950; letter-spacing:.04em; }
        .applications-status.approved{ background:rgba(22,163,74,.08); color:#15803d; border:1px solid rgba(22,163,74,.12); }
        .applications-status.rejected{ background:rgba(180,35,24,.08); color:#b42318; border:1px solid rgba(180,35,24,.12); }
        .applications-status.pending{ background:rgba(15,23,42,.05); color:#475569; border:1px solid rgba(15,23,42,.08); }
        .applications-skeleton{ height:74px; border-radius:18px; background:linear-gradient(90deg, rgba(241,245,249,.9), rgba(248,250,252,1), rgba(241,245,249,.9)); }
        .applications-empty-title{ font-size:24px; font-weight:950; letter-spacing:-.03em; color:#0f172a; }
        .applications-empty-copy{ margin-top:8px; font-size:14px; line-height:1.7; font-weight:700; color:rgba(15,23,42,.56); }
        @media (max-width:720px){
          .applications-card{ grid-template-columns:1fr; }
          .applications-card-side{ justify-items:start; }
          .applications-actions button{ flex:1 1 180px; }
        }
      `}</style>
    </div>
  );
}
