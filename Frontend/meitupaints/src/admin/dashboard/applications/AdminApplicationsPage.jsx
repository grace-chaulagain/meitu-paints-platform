import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useGetAdminDealerApplicationsQuery,
  useGetAdminDispatcherApplicationsQuery,
} from "../../../redux/api/meituApi.js";
import {
  DashboardUIStyles,
  EmptyState,
  GhostButton,
  Pill,
  SectionHeader,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { AppleDropdown } from "../../../components/dashboard/ApplePickers.jsx";
import AdminDealerApplicationDetailPage from "../dealers/AdminDealerApplicationDetailPage.jsx";
import AdminDispatcherApplicationDetailPage from "../dispatchers/AdminDispatcherApplicationDetailPage.jsx";

const FILTERS = [
  { key: "ALL_STATUS", label: "All statuses" },
  { key: "PENDING", label: "Pending" },
  { key: "VERIFIED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

function StatusPill({ status }) {
  const normalized = String(status || "PENDING").toUpperCase();
  const tone =
    normalized === "VERIFIED"
      ? "positive"
      : normalized === "REJECTED"
        ? "critical"
        : "neutral";
  const label = normalized === "VERIFIED" ? "APPROVED" : normalized;
  return (
    <Pill tone={tone} size="small">
      {label}
    </Pill>
  );
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

const APPLICATION_PALETTE = {
  DEALER: { bg: "rgba(201,42,31,.1)", fg: "#c92a1f", icon: "store" },
  DISPATCHER: { bg: "rgba(0,113,227,.1)", fg: "var(--color-azure, #0071e3)", icon: "handshake" },
};

function applicationPalette(type) {
  return APPLICATION_PALETTE[type] || APPLICATION_PALETTE.DEALER;
}

function applicationSubtitle(item) {
  if (item.type === "DISPATCHER") return item.contactName || "Dispatcher application";
  return item.contactName || "Dealer application";
}

function applicationDate(value) {
  if (!value) return "No date";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function applicationTypeMeta(type) {
  return {
    icon: applicationPalette(type).icon,
  };
}

function ApplicationCard({ item, onOpen }) {
  const isDispatcher = item.type === "DISPATCHER";
  const typeMeta = applicationTypeMeta(item.type);
  const palette = applicationPalette(item.type);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`application-card ${isDispatcher ? "is-dispatcher" : "is-dealer"}`}
      style={{ "--avatar-bg": palette.bg, "--avatar-fg": palette.fg }}
    >
      <div className="application-card-top">
        <span className="application-card-avatar" aria-hidden="true">
          <DashboardIcon name={typeMeta.icon} size={17} strokeWidth={1.9} />
        </span>
        <div className="application-card-status">
          <StatusPill status={item.normalizedStatus} />
        </div>
      </div>

      <div className="application-card-copy">
        <h3>{item.title}</h3>
        <div className="application-card-location">
          <span className="application-card-dot" aria-hidden="true" />
          <span>{applicationSubtitle(item)}</span>
        </div>
      </div>

      <div className="application-card-actions" aria-hidden="true">
        <span className="application-card-action-btn" title={formatType(item.type)}>
          <DashboardIcon name={typeMeta.icon} size={15} strokeWidth={1.8} />
        </span>
        <span className="application-card-action-btn" title={applicationDate(item.submittedAt)}>
          <DashboardIcon name="calendar" size={15} strokeWidth={1.8} />
        </span>
        <span className="application-card-action-btn is-primary" title="Review">
          <DashboardIcon name="chevron" size={15} strokeWidth={2.1} />
        </span>
      </div>
    </button>
  );
}

function ApplicationViewToggle({ value, onChange }) {
  return (
    <div className="applications-view-toggle" aria-label="Application view">
      {[
        { key: "GRID", label: "Grid", icon: "overview" },
        { key: "LIST", label: "List", icon: "list" },
      ].map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            aria-label={`${option.label} view`}
            aria-pressed={active}
            className={`applications-view-toggle-btn ${active ? "is-active" : ""}`}
            onClick={() => onChange(option.key)}
          >
            <DashboardIcon name={option.icon} size={15} strokeWidth={1.9} />
          </button>
        );
      })}
    </div>
  );
}

function ApplicationTypeToggle({ value, onChange, counts }) {
  const options = [
    { key: "ALL", label: "All", icon: "overview", count: counts.ALL },
    { key: "DEALER", label: "Dealers", icon: "store", count: counts.DEALER },
    { key: "DISPATCHER", label: "Dispatchers", icon: "handshake", count: counts.DISPATCHER },
  ];

  return (
    <div className="applications-type-toggle" aria-label="Application type">
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            aria-label={`${option.label}${active ? ", selected" : ""}`}
            aria-pressed={active}
            className={`applications-type-toggle-btn ${active ? "is-active" : ""} is-${option.key.toLowerCase()}`}
            onClick={() => onChange(option.key)}
          >
            <DashboardIcon name={option.icon} size={15} strokeWidth={1.9} />
            <span>{option.label}</span>
            <em>{option.count}</em>
          </button>
        );
      })}
    </div>
  );
}

export default function AdminApplicationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [filter, setFilter] = useState("PENDING");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState("GRID");
  const [selectedApplication, setSelectedApplication] = useState(null); // { type, id } | null
  const dealerApplicationsQuery = useGetAdminDealerApplicationsQuery({ limit: 100 });
  const dispatcherApplicationsQuery = useGetAdminDispatcherApplicationsQuery({
    limit: 100,
  });

  // Other workspaces (e.g. the Dispatchers list) can deep-link a specific
  // application into this hub via router state instead of a dedicated route,
  // since per-application URLs are intentionally not exposed.
  useEffect(() => {
    const openDispatcherId = location.state?.openDispatcherId;
    if (openDispatcherId) {
      setSelectedApplication({ type: "DISPATCHER", id: openDispatcherId });
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

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
      ALL_STATUS: items.length,
      PENDING: items.filter((item) => item.normalizedStatus === "PENDING").length,
      VERIFIED: items.filter((item) => item.normalizedStatus === "VERIFIED")
        .length,
      REJECTED: items.filter((item) => item.normalizedStatus === "REJECTED")
        .length,
      DEALER: items.filter((item) => item.type === "DEALER").length,
      DISPATCHER: items.filter((item) => item.type === "DISPATCHER").length,
    };
  }, [items]);

  const filterOptions = FILTERS.map((option) => ({
    ...option,
    count: counts[option.key],
    label: `${option.label} · ${counts[option.key]}`,
  }));

  const visibleItems = useMemo(() => {
    const statusFiltered =
      filter === "ALL_STATUS"
        ? items
        : items.filter((item) => item.normalizedStatus === filter);

    if (typeFilter === "ALL") return statusFiltered;
    return statusFiltered.filter((item) => item.type === typeFilter);
  }, [filter, items, typeFilter]);

  function openWorkspace(item) {
    setSelectedApplication({ type: item.type, id: item._id });
  }

  if (selectedApplication?.type === "DISPATCHER") {
    return (
      <AdminDispatcherApplicationDetailPage
        dispatcherId={selectedApplication.id}
        onBack={() => setSelectedApplication(null)}
      />
    );
  }

  if (selectedApplication?.type === "DEALER") {
    return (
      <AdminDealerApplicationDetailPage
        applicationId={selectedApplication.id}
        onBack={() => setSelectedApplication(null)}
      />
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <Surface padding={20} className="dash-fade-up">
        <SectionHeader
          title="Applications"
          subtitle="Dealer and dispatcher intake."
          action={
            <GhostButton onClick={loadData} icon="sort">
              {refreshing ? "Updating…" : "Refresh"}
            </GhostButton>
          }
        />

        <div className="applications-toolbar">
          <div className="applications-toolbar-left">
            <AppleDropdown
              icon="filter"
              value={filter}
              options={filterOptions}
              onChange={setFilter}
              placeholder="Status"
              style={{ width: 220 }}
            />
            <ApplicationTypeToggle value={typeFilter} onChange={setTypeFilter} counts={counts} />
          </div>
          <ApplicationViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        {error ? (
          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 12,
              background: "rgba(180,35,24,.08)",
              border: "1px solid rgba(180,35,24,.14)",
              color: "#b42318",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        ) : null}
      </Surface>

      {loading ? (
        <Surface padding={18}>
          <div style={{ display: "grid", gap: 10 }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                style={{
                  height: 56,
                  borderRadius: 12,
                  background:
                    "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))",
                }}
              />
            ))}
          </div>
        </Surface>
      ) : visibleItems.length ? (
        <div className={`applications-card-grid is-${viewMode.toLowerCase()} dash-fade-up`}>
          {visibleItems.map((item) => (
            <ApplicationCard
              key={`${item.type}-${item._id}`}
              item={item}
              onOpen={() => openWorkspace(item)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="inbox"
          title="No applications found"
          subtitle="This view has no matching dealer or dispatcher applications."
        />
      )}

      <style>{`
        .applications-toolbar{
          margin-top:16px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          flex-wrap:wrap;
        }
        .applications-toolbar-left{
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }
        .applications-type-toggle{
          display:inline-flex;
          align-items:center;
          gap:4px;
          padding:3px;
          border-radius:999px;
          background:rgba(232,232,237,.7);
          box-shadow:inset 0 0 0 1px rgba(29,29,31,.045);
        }
        .applications-type-toggle-btn{
          height:34px;
          border:none;
          border-radius:999px;
          padding:0 10px;
          background:transparent;
          color:var(--color-graphite, #707070);
          display:inline-flex;
          align-items:center;
          gap:7px;
          font-family:inherit;
          font-size:12px;
          font-weight:760;
          cursor:pointer;
          transition:background .16s ease, color .16s ease, transform .16s cubic-bezier(.23,1,.32,1), box-shadow .16s ease;
        }
        .applications-type-toggle-btn em{
          min-width:20px;
          height:20px;
          padding:0 6px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          background:rgba(29,29,31,.06);
          color:inherit;
          font-style:normal;
          font-size:10.5px;
          font-weight:820;
        }
        .applications-type-toggle-btn:hover{
          color:var(--color-ink, #1d1d1f);
          background:rgba(255,255,255,.64);
        }
        .applications-type-toggle-btn:active{
          transform:scale(.965);
        }
        .applications-type-toggle-btn.is-active{
          background:#fff;
          box-shadow:0 6px 16px rgba(29,29,31,.1);
        }
        .applications-type-toggle-btn.is-all.is-active{
          color:var(--color-ink, #1d1d1f);
        }
        .applications-type-toggle-btn.is-dealer.is-active{
          color:#c92a1f;
        }
        .applications-type-toggle-btn.is-dispatcher.is-active{
          color:var(--color-azure, #0071e3);
        }
        .applications-type-toggle-btn.is-active em{
          background:currentColor;
          color:#fff;
        }
        .applications-type-toggle-btn:focus-visible{
          outline:2px solid rgba(0,113,227,.38);
          outline-offset:2px;
        }
        .applications-view-toggle{
          display:inline-flex;
          align-items:center;
          gap:3px;
          padding:3px;
          border-radius:999px;
          background:rgba(232,232,237,.7);
          box-shadow:inset 0 0 0 1px rgba(29,29,31,.045);
        }
        .applications-view-toggle-btn{
          width:34px;
          height:34px;
          border:none;
          border-radius:999px;
          background:transparent;
          color:var(--color-graphite, #707070);
          display:grid;
          place-items:center;
          cursor:pointer;
          transition:background .16s ease, color .16s ease, transform .16s cubic-bezier(.23,1,.32,1), box-shadow .16s ease;
        }
        .applications-view-toggle-btn:hover{
          color:var(--color-ink, #1d1d1f);
          background:rgba(255,255,255,.64);
        }
        .applications-view-toggle-btn:active{
          transform:scale(.94);
        }
        .applications-view-toggle-btn.is-active{
          color:var(--color-ink, #1d1d1f);
          background:#fff;
          box-shadow:0 6px 16px rgba(29,29,31,.1);
        }
        .applications-view-toggle-btn:focus-visible{
          outline:2px solid rgba(0,113,227,.38);
          outline-offset:2px;
        }
        .applications-card-grid{
          display:grid;
          grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));
          gap:12px;
        }
        .applications-card-grid.is-list{
          grid-template-columns:1fr;
          gap:10px;
        }
        .application-card{
          position:relative;
          height:208px;
          width:100%;
          padding:18px;
          border:none;
          border-radius:20px;
          background:#fff;
          box-shadow:inset 0 0 0 1px rgba(29,29,31,.07);
          color:var(--color-ink, #1d1d1f);
          font-family:inherit;
          text-align:left;
          cursor:pointer;
          display:flex;
          flex-direction:column;
          overflow:hidden;
          transition:transform .18s ease, box-shadow .18s ease, background .18s ease;
        }
        .application-card.is-dealer{
          --app-accent:#c92a1f;
        }
        .application-card.is-dispatcher{
          --app-accent:var(--color-azure, #0071e3);
        }
        .application-card:hover{
          transform:translateY(-2px);
          box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--app-accent) 18%, transparent), 0 14px 30px rgba(0,0,0,.06);
        }
        .application-card:active{
          transform:translateY(0) scale(.992);
          box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--app-accent) 15%, transparent), 0 8px 20px rgba(0,0,0,.05);
        }
        .application-card:focus-visible{
          outline:2px solid color-mix(in srgb, var(--app-accent) 40%, transparent);
          outline-offset:3px;
        }
        .applications-card-grid.is-list .application-card{
          height:76px;
          display:grid;
          grid-template-columns:auto minmax(0, 1fr) auto;
          align-items:center;
          gap:12px;
          padding:14px 16px;
          border-radius:18px;
          flex-direction:unset;
        }
        .application-card-top{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:8px;
        }
        .application-card-avatar{
          width:44px;
          height:44px;
          border-radius:13px;
          flex:0 0 44px;
          display:grid;
          place-items:center;
          color:var(--avatar-fg, var(--color-azure,#0071e3));
          background:var(--avatar-bg, rgba(0,113,227,.08));
        }
        .application-card-status{
          display:flex;
          justify-content:flex-end;
        }
        .application-card-copy{
          min-width:0;
          margin-top:14px;
          flex:1 1 auto;
          display:grid;
          align-content:start;
          gap:6px;
        }
        .application-card-copy h3{
          margin:0;
          color:var(--color-ink,#1d1d1f);
          font-family:var(--font-sf-pro-display, inherit);
          font-size:15.5px;
          line-height:1.28;
          font-weight:700;
          letter-spacing:-.02em;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .application-card-location{
          display:flex;
          align-items:center;
          gap:7px;
          color:var(--color-graphite,#707070);
          font-size:12.5px;
          font-weight:600;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .application-card-dot{
          flex:0 0 auto;
          width:7px;
          height:7px;
          border-radius:999px;
          background:var(--avatar-fg, var(--color-azure,#0071e3));
        }
        .application-card-actions{
          margin-top:16px;
          padding-top:14px;
          border-top:1px solid rgba(29,29,31,.06);
          display:flex;
          align-items:center;
          gap:8px;
        }
        .application-card-chevron{
          color:var(--color-graphite, #707070);
          opacity:.72;
          transition:transform .18s cubic-bezier(.23,1,.32,1), color .18s ease;
        }
        .application-card-action-btn{
          width:34px;
          height:34px;
          border-radius:11px;
          display:grid;
          place-items:center;
          background:var(--color-fog,#f5f5f7);
          color:var(--color-graphite, #707070);
          transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease);
        }
        .application-card-action-btn.is-primary{
          margin-left:auto;
        }
        .application-card:hover .application-card-action-btn.is-primary,
        .application-card-action-btn:hover{
          background:color-mix(in srgb, var(--app-accent) 10%, transparent);
          color:var(--app-accent);
        }
        .application-card:active .application-card-action-btn{
          transform:scale(.92);
        }
        .applications-card-grid.is-list .application-card-top{
          display:contents;
        }
        .applications-card-grid.is-list .application-card-status{
          justify-content:flex-start;
        }
        .applications-card-grid.is-list .application-card-copy{
          margin-top:0;
          gap:3px;
        }
        .applications-card-grid.is-list .application-card-location{
          font-size:12px;
        }
        .applications-card-grid.is-list .application-card-actions{
          margin-top:0;
          padding-top:0;
          border-top:0;
          justify-content:flex-end;
        }
        @media (max-width:720px){
          .applications-toolbar{
            align-items:stretch;
          }
          .applications-toolbar-left{
            width:100%!important;
          }
          .applications-toolbar-left > div:first-child{
            width:100%!important;
          }
          .applications-type-toggle{
            width:100%;
          }
          .applications-type-toggle-btn{
            flex:1;
            justify-content:center;
          }
          .applications-view-toggle{
            margin-left:auto;
          }
          .applications-card-grid{
            grid-template-columns:1fr;
          }
          .application-card{
            height:188px;
          }
          .applications-card-grid.is-list .application-card{
            height:auto;
            min-height:78px;
            grid-template-columns:auto minmax(0, 1fr);
          }
          .applications-card-grid.is-list .application-card-actions{
            grid-column:2;
            justify-content:flex-start;
          }
        }
      `}</style>
    </div>
  );
}
