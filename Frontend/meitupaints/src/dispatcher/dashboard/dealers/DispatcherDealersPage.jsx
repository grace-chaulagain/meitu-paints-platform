import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetDispatcherDealersQuery } from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import {
  Avatar,
  DashboardUIStyles,
  EmptyState,
  GhostButton,
  ListRow,
  MetricTile,
  Pill,
  SearchField,
  SectionHeader,
  SegmentedControl,
  Surface,
  ViewToggle,
} from "../../../components/dashboard/DashboardUI.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";

const STATUS_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "SUSPENDED", label: "Suspended" },
  { key: "VERIFIED", label: "Verified" },
];

const VIEW_STORAGE_KEY = "meitu.dispatcher.dealers.view";

function getInitialView() {
  if (typeof window === "undefined") return "list";
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) || "list";
  } catch {
    return "list";
  }
}

function statusTone(status) {
  if (status === "ACTIVE" || status === "VERIFIED") return "positive";
  if (status === "SUSPENDED") return "critical";
  return "neutral";
}

// Same avatar palette / initials / location grammar as AdminDealersPage's
// DealersCard, so the grid view here reads as the same design language.
const AVATAR_PALETTE = [
  { bg: "rgba(220,38,38,.12)", fg: "#dc2626" },
  { bg: "rgba(124,58,237,.12)", fg: "#7c3aed" },
  { bg: "rgba(234,88,12,.12)", fg: "#ea580c" },
  { bg: "rgba(22,163,74,.12)", fg: "#16a34a" },
  { bg: "rgba(0,113,227,.12)", fg: "#0071e3" },
  { bg: "rgba(219,39,119,.12)", fg: "#db2777" },
  { bg: "rgba(13,148,136,.12)", fg: "#0d9488" },
  { bg: "rgba(75,85,99,.12)", fg: "#4b5563" },
];

function hashString(value) {
  let hash = 0;
  const str = String(value || "");
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function dealerPalette(dealer) {
  const key = dealer._id || dealer.companyName || "dealer";
  return AVATAR_PALETTE[hashString(key) % AVATAR_PALETTE.length];
}

function dealerInitials(dealer) {
  const name = String(dealer.companyName || dealer.contactName || "Dealer").trim();
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function dealerLocation(dealer) {
  const address = String(dealer.address || "").trim();
  if (!address) return "No address on file";
  return address.split(",")[0].trim();
}

function DispatcherDealerGridCard({ dealer, onOpen, onViewOrders }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const palette = dealerPalette(dealer);

  return (
    <article className="dispatcher-dealer-grid-card" onClick={onOpen}>
      <div className="dispatcher-dealer-grid-card-top">
        <div className="dispatcher-dealer-grid-avatar" style={{ "--avatar-bg": palette.bg, "--avatar-fg": palette.fg }}>
          {dealerInitials(dealer)}
        </div>

        <div className="dispatcher-dealer-grid-menu-wrap" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="dispatcher-dealer-grid-menu-btn"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="More actions"
            aria-expanded={menuOpen}
          >
            <DashboardIcon name="moreHorizontal" size={16} strokeWidth={2} />
          </button>
          {menuOpen ? (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMenuOpen(false)} />
              <div className="dispatcher-dealer-grid-menu dash-modal-surface-in">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpen();
                  }}
                >
                  View profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onViewOrders();
                  }}
                >
                  View orders
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="dispatcher-dealer-grid-copy">
        <h3>{dealer.companyName || "Unnamed Dealer"}</h3>
        <div className="dispatcher-dealer-grid-location">
          <span className="dispatcher-dealer-grid-dot" style={{ "--dot-color": palette.fg }} aria-hidden="true" />
          {dealerLocation(dealer)}
        </div>
      </div>

      <div className="dispatcher-dealer-grid-actions" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="dispatcher-dealer-grid-action-btn"
          onClick={onOpen}
          aria-label="View dealer profile"
          title="View profile"
        >
          <DashboardIcon name="eye" size={15} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className="dispatcher-dealer-grid-action-btn"
          onClick={onViewOrders}
          aria-label="View dealer orders"
          title="View orders"
        >
          <DashboardIcon name="orders" size={15} strokeWidth={1.8} />
        </button>
      </div>
    </article>
  );
}

function DealerRow({ dealer, onOpen, onViewOrders }) {
  return (
    <ListRow onClick={onOpen}>
      <Avatar label={dealer.companyName || dealer.contactName || "D"} size={36} />

      <div style={{ minWidth: 0, flex: 1, display: "grid", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>
            {dealer.companyName || "Unnamed Dealer"}
          </span>
          <Pill tone={statusTone(dealer.status)} size="small">{dealer.status || "—"}</Pill>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)", fontWeight: 500 }}>
          {dealer.contactName ? `${dealer.contactName} · ` : ""}
          {dealer.email || dealer.phone || "No contact on file"}
        </div>
      </div>

      <div style={{ flex: "0 0 auto" }}>
        <GhostButton
          icon="orders"
          onClick={(event) => {
            event.stopPropagation();
            onViewOrders();
          }}
        >
          Orders
        </GhostButton>
      </div>
    </ListRow>
  );
}

export default function DispatcherDealersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [view, setView] = useState(getInitialView);

  function updateView(next) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // View preference is a nice-to-have; storage failures should not block browsing.
    }
  }

  const dealerParams = useMemo(() => ({ limit: 100 }), []);
  const dealersQuery = useGetDispatcherDealersQuery(dealerParams);
  const dealers = useMemo(() => dealersQuery.data?.items || [], [dealersQuery.data]);
  const loading = dealersQuery.isLoading && dealers.length === 0;
  const isRefreshing = !loading && dealersQuery.isFetching;
  const error = dealersQuery.error ? getQueryErrorMessage(dealersQuery.error, "Failed to load assigned dealers.") : "";

  const filteredByStatus = useMemo(() => {
    if (statusFilter === "ALL") return dealers;
    return dealers.filter((dealer) => dealer.status === statusFilter);
  }, [dealers, statusFilter]);

  const filteredDealers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return filteredByStatus;
    return filteredByStatus.filter((dealer) =>
      [dealer.companyName, dealer.contactName, dealer.phone, dealer.email, dealer.address, dealer.panVat]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [filteredByStatus, search]);

  const metrics = useMemo(() => {
    const total = dealers.length;
    const active = dealers.filter((d) => d.status === "ACTIVE").length;
    const suspended = dealers.filter((d) => d.status === "SUSPENDED").length;
    const routed = dealers.filter((d) => (d.fulfillmentMode || "FACTORY") === "DISPATCHER").length;
    return { total, active, suspended, routed };
  }, [dealers]);

  const countsByFilter = useMemo(
    () => ({
      ALL: dealers.length,
      VERIFIED: dealers.filter((d) => d.status === "VERIFIED").length,
      ACTIVE: dealers.filter((d) => d.status === "ACTIVE").length,
      SUSPENDED: dealers.filter((d) => d.status === "SUSPENDED").length,
    }),
    [dealers],
  );

  const segmentOptions = STATUS_FILTERS.map((option) => ({ ...option, count: countsByFilter[option.key] }));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          icon="store"
          title="Assigned Dealers"
          subtitle={isRefreshing ? "Updating…" : "Dealer accounts routed to your dispatcher workspace."}
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ViewToggle value={view} onChange={updateView} />
              <GhostButton icon="refresh" onClick={() => dealersQuery.refetch()}>Refresh</GhostButton>
            </div>
          }
        />

        <div style={{ marginTop: 18, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 260px", maxWidth: 380 }}>
            <SearchField value={search} onChange={setSearch} placeholder="Search company, contact, phone, email…" />
          </div>
          <SegmentedControl options={segmentOptions} value={statusFilter} onChange={setStatusFilter} />
        </div>

        {error ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        ) : null}
      </Surface>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <MetricTile icon="store" label="Assigned Dealers" value={metrics.total} tone="accent" />
        <MetricTile icon="checkmark" label="Active" value={metrics.active} />
        <MetricTile icon="warning" label="Suspended" value={metrics.suspended} />
        <MetricTile icon="truck" label="Dispatcher Routed" value={metrics.routed} />
      </div>

      {loading ? (
        <Surface padding={18}>
          <div style={{ height: 220, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : filteredDealers.length === 0 ? (
        <EmptyState icon="store" title="No assigned dealers found" subtitle="Try adjusting the search or filter." />
      ) : view === "list" ? (
        <Surface padding={0} className="dash-fade-up">
          {filteredDealers.map((dealer) => (
            <DealerRow
              key={dealer._id}
              dealer={dealer}
              onOpen={() => navigate(`/dispatcher/dashboard/dealers/${dealer._id}`)}
              onViewOrders={() => navigate(`/dispatcher/dashboard/dealers/${dealer._id}/orders`)}
            />
          ))}
        </Surface>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 264px), 1fr))",
            gap: 16,
            alignItems: "start",
          }}
          className="dash-fade-up"
        >
          {filteredDealers.map((dealer) => (
            <DispatcherDealerGridCard
              key={dealer._id}
              dealer={dealer}
              onOpen={() => navigate(`/dispatcher/dashboard/dealers/${dealer._id}`)}
              onViewOrders={() => navigate(`/dispatcher/dashboard/dealers/${dealer._id}/orders`)}
            />
          ))}
        </div>
      )}

      <style>{`
        .dispatcher-dealer-grid-card{
          position:relative;
          height:208px;
          display:flex;
          flex-direction:column;
          border-radius:20px;
          border:1px solid rgba(29,29,31,.07);
          background:#fff;
          padding:18px;
          cursor:pointer;
          transition:transform .18s ease, border-color .18s ease, box-shadow .18s ease;
        }
        .dispatcher-dealer-grid-card:hover{
          transform:translateY(-2px);
          border-color:rgba(0,113,227,.16);
          box-shadow:0 14px 30px rgba(0,0,0,.06);
        }
        .dispatcher-dealer-grid-card-top{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:8px;
        }
        .dispatcher-dealer-grid-avatar{
          width:44px;
          height:44px;
          border-radius:13px;
          flex:0 0 44px;
          display:grid;
          place-items:center;
          color:var(--avatar-fg, var(--color-azure,#0071e3));
          background:var(--avatar-bg, rgba(0,113,227,.08));
          font-size:15px;
          font-weight:800;
          letter-spacing:-.01em;
        }
        .dispatcher-dealer-grid-menu-wrap{
          position:relative;
          flex:0 0 auto;
        }
        .dispatcher-dealer-grid-menu-btn{
          width:28px;
          height:28px;
          border:0;
          border-radius:999px;
          display:grid;
          place-items:center;
          background:transparent;
          color:var(--color-graphite,#707070);
          cursor:pointer;
          transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease);
        }
        .dispatcher-dealer-grid-menu-btn:hover{
          background:var(--color-fog,#f5f5f7);
          color:var(--color-ink,#1d1d1f);
        }
        .dispatcher-dealer-grid-menu-btn:active{
          transform:scale(.9);
        }
        .dispatcher-dealer-grid-menu{
          position:absolute;
          top:calc(100% + 6px);
          right:0;
          z-index:50;
          min-width:160px;
          padding:6px;
          border-radius:14px;
          background:#fff;
          border:1px solid rgba(0,0,0,.06);
          box-shadow:0 12px 32px rgba(0,0,0,.16), 0 1px 0 rgba(0,0,0,.04);
          display:grid;
          gap:2px;
          transform-origin:top right;
        }
        .dispatcher-dealer-grid-menu button{
          border:0;
          background:transparent;
          text-align:left;
          padding:9px 10px;
          border-radius:9px;
          font-size:12.5px;
          font-weight:650;
          color:var(--color-ink,#1d1d1f);
          cursor:pointer;
        }
        .dispatcher-dealer-grid-menu button:hover{
          background:rgba(0,113,227,.08);
        }
        .dispatcher-dealer-grid-copy{
          min-width:0;
          margin-top:14px;
          flex:1 1 auto;
          display:grid;
          align-content:start;
          gap:6px;
        }
        .dispatcher-dealer-grid-copy h3{
          margin:0;
          color:var(--color-ink,#1d1d1f);
          font-size:15.5px;
          line-height:1.28;
          font-weight:700;
          letter-spacing:-.02em;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }
        .dispatcher-dealer-grid-location{
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
        .dispatcher-dealer-grid-dot{
          flex:0 0 auto;
          width:7px;
          height:7px;
          border-radius:999px;
          background:var(--dot-color, var(--color-azure,#0071e3));
        }
        .dispatcher-dealer-grid-actions{
          margin-top:16px;
          padding-top:14px;
          border-top:1px solid rgba(29,29,31,.06);
          display:flex;
          align-items:center;
          gap:8px;
        }
        .dispatcher-dealer-grid-action-btn{
          width:34px;
          height:34px;
          border:0;
          border-radius:11px;
          display:grid;
          place-items:center;
          background:var(--color-fog,#f5f5f7);
          color:var(--color-graphite,#707070);
          cursor:pointer;
          transition:background .14s ease, color .14s ease, transform .14s var(--ease-out, ease);
        }
        .dispatcher-dealer-grid-action-btn:hover{
          background:rgba(0,113,227,.1);
          color:var(--color-azure,#0071e3);
        }
        .dispatcher-dealer-grid-action-btn:active{
          transform:scale(.92);
        }
        @media (prefers-reduced-motion: reduce){
          .dispatcher-dealer-grid-menu-btn,
          .dispatcher-dealer-grid-action-btn{
            transition:none!important;
          }
        }
      `}</style>
    </div>
  );
}
