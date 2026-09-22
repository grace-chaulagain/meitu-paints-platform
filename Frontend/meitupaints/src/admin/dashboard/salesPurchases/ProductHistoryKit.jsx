import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { buildPageList, formatDayLabel, formatQty, formatWeekday } from "./salesPurchasesFormat.js";

// The day-grouped timeline the dealer and dispatcher per-product history
// pages share. Each page maps its own records onto ProductHistoryCard; the
// timeline, cards, pager and styles are identical. Lifted unchanged from the
// dealer page.

// A plain, minimal top-left back link - Apple's own back-navigation
// convention (chevron + text, no button chrome) rather than a boxed
// button competing with the page's real actions.
export function BackLink({ onClick, children }) {
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
        width: "fit-content",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 6-6 6 6 6" />
      </svg>
      {children}
    </button>
  );
}

// `variant` is "order" (a purchase: blue) or "sale" (green, red once voided).
export function ProductHistoryCard({ variant, voided = false, icon, kind, title, sub, pill, quantity, onClick, style }) {
  return (
    <button
      type="button"
      className={`admin-sph-card admin-sph-card--${variant} ${voided ? "is-voided" : ""}`}
      style={style}
      onClick={onClick}
    >
      <span className="admin-sph-card-icon">
        <DashboardIcon name={icon} size={16} strokeWidth={1.8} />
      </span>
      <div className="admin-sph-card-main">
        <div className="admin-sph-card-title">
          <span className="admin-sph-card-kind">{kind}</span>
          {title}
        </div>
        <div className="admin-sph-card-sub">{sub}</div>
      </div>
      {pill}
      <span className="admin-sph-card-qty">{formatQty(quantity)}</span>
      <DashboardIcon name="chevron" size={13} strokeWidth={2.2} style={{ color: "var(--color-graphite,#707070)", flexShrink: 0 }} />
    </button>
  );
}

// `renderEvent(event, style)` draws one card; `style` carries the entrance
// stagger.
export function ProductHistoryDayGroup({ group, renderEvent, animate }) {
  return (
    <div className="admin-sph-day">
      <div className="admin-sph-day-header">
        <span className="admin-sph-day-marker" aria-hidden="true" />
        <div>
          <div className="admin-sph-day-date">{formatDayLabel(group.date)}</div>
          <div className="admin-sph-day-weekday">{formatWeekday(group.date)}</div>
        </div>
      </div>
      <div className="admin-sph-day-body">
        {group.events.map((event, index) => {
          // Staggered entrance only plays once per tab load - each card's
          // own re-renders (e.g. a background refetch updating its status
          // pill) don't replay it, since the delay is baked into a single
          // mount-time inline style, not re-derived from index on every render.
          const cardStyle = animate ? { animationDelay: `${Math.min(index, 8) * 35}ms` } : undefined;
          return renderEvent(event, cardStyle);
        })}
      </div>
    </div>
  );
}

export function ProductHistoryPagination({ page, totalPages, totalCount, pageSize, onChange }) {
  if (totalCount === 0) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  const pages = buildPageList(page, totalPages);

  return (
    <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "6px 4px" }}>
      <span style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
        Showing {start} to {end} of {totalCount} days
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Previous page" className="admin-sph-page-btn">
          <DashboardIcon name="chevron" size={13} strokeWidth={2.4} style={{ transform: "rotate(180deg)" }} />
        </button>
        {pages.map((p) =>
          typeof p === "number" ? (
            <button key={p} type="button" onClick={() => onChange(p)} className={`admin-sph-page-btn ${p === page ? "is-active" : ""}`}>
              {p}
            </button>
          ) : (
            <span key={p} style={{ padding: "0 4px", color: "var(--color-graphite, #707070)", fontSize: 12.5 }}>
              &hellip;
            </span>
          ),
        )}
        <button type="button" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} aria-label="Next page" className="admin-sph-page-btn">
          <DashboardIcon name="chevron" size={13} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

export function ProductHistoryStyles() {
  return (
    <style>{`
      .admin-sph-timeline{
        position:relative;
        display:grid;
        gap:22px;
      }
      .admin-sph-timeline::before{
        content:"";
        position:absolute;
        left:6px;
        top:4px;
        bottom:4px;
        width:2px;
        background:linear-gradient(180deg, rgba(0,113,227,.22), rgba(29,29,31,.08));
      }
      .admin-sph-day{
        position:relative;
        display:grid;
        gap:10px;
      }
      .admin-sph-day-header{
        position:relative;
        display:flex;
        align-items:center;
        gap:14px;
      }
      .admin-sph-day-marker{
        position:relative;
        z-index:1;
        width:13px;
        height:13px;
        border-radius:999px;
        background:#fff;
        border:2px solid rgba(0,113,227,.8);
        flex-shrink:0;
        box-shadow:0 0 0 4px #fff;
      }
      .admin-sph-day-date{
        font-size:13.5px;
        font-weight:750;
        color:var(--color-ink,#1d1d1f);
      }
      .admin-sph-day-weekday{
        margin-top:1px;
        font-size:11.5px;
        color:var(--color-graphite,#707070);
      }
      .admin-sph-day-body{
        margin-left:27px;
        display:grid;
        gap:8px;
      }
      .admin-sph-card{
        display:flex;
        align-items:center;
        gap:12px;
        width:100%;
        padding:11px 14px;
        border-radius:14px;
        border:1px solid rgba(29,29,31,.07);
        border-left-width:3px;
        background:#fff;
        cursor:pointer;
        text-align:left;
        transition:box-shadow .16s var(--ease-out, ease), border-color .16s ease, transform .16s var(--ease-out, ease);
        animation:adminSphCardIn .3s var(--ease-out, cubic-bezier(.23,1,.32,1)) both;
      }
      @keyframes adminSphCardIn{
        from{ opacity:0; transform:translateY(6px) scale(.98); }
        to{ opacity:1; transform:translateY(0) scale(1); }
      }
      .admin-sph-card:hover{
        box-shadow:0 10px 24px rgba(15,23,42,.06);
        transform:translateY(-1px);
      }
      .admin-sph-card:active{
        transform:scale(.99);
      }
      .admin-sph-card-icon{
        width:32px;
        height:32px;
        border-radius:10px;
        flex-shrink:0;
        display:grid;
        place-items:center;
      }
      .admin-sph-card--order{
        border-left-color:var(--color-azure,#0071e3);
      }
      .admin-sph-card--order .admin-sph-card-icon{
        background:rgba(0,113,227,.1);
        color:var(--color-azure,#0071e3);
      }
      .admin-sph-card--sale{
        border-left-color:#15803d;
      }
      .admin-sph-card--sale .admin-sph-card-icon{
        background:rgba(22,163,74,.1);
        color:#15803d;
      }
      .admin-sph-card--sale.is-voided{
        border-left-color:#b42318;
      }
      .admin-sph-card--sale.is-voided .admin-sph-card-icon{
        background:rgba(180,35,24,.1);
        color:#b42318;
      }
      .admin-sph-card-main{
        min-width:0;
        flex:1 1 auto;
      }
      .admin-sph-card-title{
        display:flex;
        align-items:center;
        gap:7px;
        font-size:13.5px;
        font-weight:700;
        color:var(--color-ink,#1d1d1f);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .admin-sph-card-kind{
        flex-shrink:0;
        font-size:9.5px;
        font-weight:800;
        letter-spacing:.05em;
        text-transform:uppercase;
        padding:2px 6px;
        border-radius:999px;
      }
      .admin-sph-card--order .admin-sph-card-kind{
        background:rgba(0,113,227,.12);
        color:var(--color-azure,#0071e3);
      }
      .admin-sph-card--sale .admin-sph-card-kind{
        background:rgba(22,163,74,.12);
        color:#15803d;
      }
      .admin-sph-card--sale.is-voided .admin-sph-card-kind{
        background:rgba(180,35,24,.12);
        color:#b42318;
      }
      .admin-sph-card-sub{
        margin-top:2px;
        font-size:11.5px;
        color:var(--color-graphite,#707070);
      }
      .admin-sph-card-qty{
        flex-shrink:0;
        min-width:60px;
        text-align:right;
        font-size:13px;
        font-weight:750;
        color:var(--color-ink,#1d1d1f);
      }
      .admin-sph-page-btn{
        min-width:32px;
        height:32px;
        padding:0 8px;
        border-radius:8px;
        border:none;
        background:transparent;
        font-size:12.5px;
        font-weight:700;
        color:var(--color-ink,#1d1d1f);
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        justify-content:center;
      }
      .admin-sph-page-btn:disabled{
        opacity:.35;
        cursor:not-allowed;
      }
      .admin-sph-page-btn.is-active{
        background:var(--color-azure, #0071e3);
        color:#fff;
      }
      .admin-sph-page-btn:not(.is-active):not(:disabled):hover{
        background:rgba(29,29,31,.06);
      }
      @media (max-width:640px){
        .admin-sph-card{
          flex-wrap:wrap;
        }
        .admin-sph-card-qty{
          order:5;
        }
      }
      @media (prefers-reduced-motion: reduce){
        .admin-sph-card{ animation:none!important; }
      }
    `}</style>
  );
}
