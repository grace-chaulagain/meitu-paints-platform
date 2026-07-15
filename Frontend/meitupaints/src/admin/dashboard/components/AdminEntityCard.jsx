import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";

function toneClass(tone = "neutral") {
  return ["success", "danger", "accent", "muted"].includes(tone)
    ? tone
    : "neutral";
}

function iconForAction(action = {}) {
  const key = String(action.key || action.label || "").toLowerCase();
  if (action.icon) return action.icon;
  if (key.includes("profile") || key.includes("view") || key.includes("review")) return "user";
  if (key.includes("order")) return "orders";
  if (key.includes("route") || key.includes("routing")) return "truck";
  if (key.includes("edit")) return "edit";
  if (key.includes("delete") || key.includes("deactivate")) return "trash";
  if (key.includes("activate") || key.includes("approve") || key.includes("restore") || key.includes("undo")) return "check";
  return "chevron";
}

export function AdminEntityCardStyles() {
  return (
    <style>{`
      .admin-entity-card{
        position:relative;
        border-radius:24px;
        border:1px solid rgba(29,29,31,.08);
        background:linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,255,255,.92));
        overflow:hidden;
        transition:transform .18s ease, border-color .18s ease, background .18s ease;
      }
      .admin-entity-card:hover{
        transform:translateY(-2px);
        border-color:rgba(29,29,31,.14);
      }
      .admin-entity-card::before{
        content:"";
        position:absolute;
        inset:0 0 auto;
        height:3px;
        background:linear-gradient(90deg, rgba(29,29,31,.14), transparent);
      }
      .admin-entity-card.accent::before{ background:var(--color-azure,#0071e3); }
      .admin-entity-card.success::before{ background:#16a34a; }
      .admin-entity-card.danger::before{ background:#b91c1c; }
      .admin-entity-card.is-selected{
        background:rgba(0,113,227,.06);
        border-color:rgba(0,113,227,.28);
      }
      .admin-entity-inner{
        padding:17px;
        display:grid;
        gap:14px;
      }
      .admin-entity-main{
        min-width:0;
        display:grid;
        grid-template-columns:auto 44px minmax(0,1fr) auto;
        gap:12px;
        align-items:start;
      }
      .admin-entity-avatar{
        width:44px;
        height:44px;
        border-radius:999px;
        display:grid;
        place-items:center;
        background:rgba(0,113,227,.1);
        color:var(--color-azure,#0071e3);
        font-size:16px;
        font-weight:800;
      }
      .admin-entity-copy{
        min-width:0;
        display:grid;
        gap:4px;
      }
      .admin-entity-title{
        min-width:0;
        margin:0;
        font-size:15.5px;
        line-height:1.25;
        font-weight:800;
        letter-spacing:-.025em;
        color:var(--color-ink, #1d1d1f);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .admin-entity-subtitle,
      .admin-entity-line{
        min-width:0;
        font-size:12px;
        line-height:1.4;
        font-weight:600;
        color:var(--color-graphite, #707070);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .admin-entity-line{ color:rgba(0,0,0,.38); }
      .admin-entity-badges{
        display:flex;
        flex-wrap:wrap;
        justify-content:flex-end;
        gap:6px;
        max-width:210px;
      }
      .admin-entity-badge{
        min-height:23px;
        padding:0 8px;
        border-radius:999px;
        display:inline-flex;
        align-items:center;
        background:rgba(0,0,0,.05);
        color:var(--color-graphite, #707070);
        font-size:10.5px;
        font-weight:750;
        white-space:nowrap;
      }
      .admin-entity-badge.success{
        background:rgba(22,163,74,.1);
        color:#15803d;
      }
      .admin-entity-badge.danger{
        background:rgba(180,35,24,.1);
        color:#b42318;
      }
      .admin-entity-badge.accent{
        background:rgba(0,113,227,.1);
        color:var(--color-azure,#0071e3);
      }
      .admin-entity-badge.muted{
        background:rgba(0,0,0,.04);
        color:rgba(0,0,0,.42);
      }
      .admin-entity-actions{
        display:flex;
        align-items:center;
        gap:7px;
        flex-wrap:wrap;
        padding-top:13px;
        border-top:1px solid rgba(29,29,31,.06);
      }
      .admin-entity-action{
        min-height:34px;
        padding:0 12px;
        border-radius:999px;
        border:none;
        background:var(--color-fog, #f5f5f7);
        color:var(--color-ink, #1d1d1f);
        font-size:12.5px;
        font-weight:750;
        cursor:pointer;
        transition:background .14s ease;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
      }
      .admin-entity-action:hover:not(:disabled){
        background:rgba(0,0,0,.08);
      }
      .admin-entity-action.primary{
        background:var(--color-azure,#0071e3);
        color:#fff;
      }
      .admin-entity-action.primary:hover:not(:disabled){
        background:var(--color-azure,#0071e3);
        opacity:.9;
      }
      .admin-entity-action.danger{
        background:rgba(180,35,24,.08);
        color:#b42318;
      }
      .admin-entity-action:disabled{
        cursor:not-allowed;
        opacity:.5;
      }
      @media (max-width:720px){
        .admin-entity-inner{ padding:14px; }
        .admin-entity-main{
          grid-template-columns:auto 36px minmax(0,1fr);
        }
        .admin-entity-avatar{
          width:36px;
          height:36px;
          border-radius:999px;
        }
        .admin-entity-badges{
          grid-column:1 / -1;
          justify-content:flex-start;
          max-width:none;
        }
        .admin-entity-title{ white-space:normal; }
        .admin-entity-actions{
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
        .admin-entity-action{ width:100%; }
      }
    `}</style>
  );
}

export default function AdminEntityCard({
  accent = "neutral",
  initial = "M",
  title = "",
  subtitle = "",
  line = "",
  badges = [],
  actions = [],
  selectable = false,
  selectionMode = false,
  selected = false,
  onSelectChange = null,
}) {
  return (
    <article
      className={`admin-entity-card ${toneClass(accent)} ${selected ? "is-selected" : ""}`}
      onClick={
        selectable && selectionMode ? () => onSelectChange?.(!selected) : undefined
      }
      style={selectable && selectionMode ? { cursor: "pointer" } : undefined}
    >
      <div className="admin-entity-inner">
        <div className="admin-entity-main">
          {selectable ? (
            <button
              type="button"
              role="checkbox"
              aria-checked={selected}
              aria-label="Select row"
              onClick={(event) => {
                event.stopPropagation();
                onSelectChange?.(!selected);
              }}
              style={{
                width: 18,
                height: 18,
                marginTop: 2,
                borderRadius: 5,
                border: selected ? "none" : "1.5px solid rgba(0,0,0,.2)",
                background: selected ? "var(--color-azure,#0071e3)" : "transparent",
                display: "grid",
                placeItems: "center",
                color: "#fff",
                cursor: "pointer",
                padding: 0,
              }}
            />
          ) : (
            <span />
          )}
          <div className="admin-entity-avatar">{initial || "M"}</div>
          <div className="admin-entity-copy">
            <h3 className="admin-entity-title">{title || "Unnamed record"}</h3>
            {subtitle ? (
              <div className="admin-entity-subtitle">{subtitle}</div>
            ) : null}
            {line ? <div className="admin-entity-line">{line}</div> : null}
          </div>
          <div className="admin-entity-badges">
            {badges.filter(Boolean).map((badge) => (
              <span
                key={`${badge.label}-${badge.tone || "neutral"}`}
                className={`admin-entity-badge ${toneClass(badge.tone)}`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        </div>

        <div className="admin-entity-actions">
          {actions.filter(Boolean).map((action) => (
            <button
              key={action.key || action.label}
              type="button"
              className={`admin-entity-action ${action.variant || ""}`}
              onClick={(event) => {
                event.stopPropagation();
                action.onClick?.(event);
              }}
              disabled={action.disabled}
              title={action.title || action.label}
            >
              <DashboardIcon name={iconForAction(action)} size={13} strokeWidth={2} />
              {action.busy ? action.busyLabel || "Working..." : action.label}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
