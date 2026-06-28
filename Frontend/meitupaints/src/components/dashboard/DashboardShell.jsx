import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import NavBar from "../NavBar.jsx";
import DashboardIcon from "./DashboardIcons.jsx";

function badgeText(value) {
  return value === null || value === undefined ? "" : String(value);
}

function DashboardNavItem({ item, active, onNavigate, compact = false }) {
  const badge = badgeText(item.badge);
  const iconName = item.icon || item.iconName || "";

  return (
    <button
      type="button"
      className={`dashboard-nav-item ${active ? "active" : ""} ${
        compact ? "compact" : ""
      } ${iconName ? "has-icon" : ""}`}
      onClick={() => onNavigate?.(item)}
    >
      {iconName ? (
        <span className="dashboard-nav-icon">
          <DashboardIcon name={iconName} size={compact ? 17 : 19} />
        </span>
      ) : null}
      <span className="dashboard-nav-copy">
        <span className="dashboard-nav-title">{item.title}</span>
        {!compact && item.subtitle ? (
          <span className="dashboard-nav-subtitle">{item.subtitle}</span>
        ) : null}
      </span>
      {badge ? <span className="dashboard-nav-badge">{badge}</span> : null}
    </button>
  );
}

export default function DashboardShell({
  title,
  eyebrow = "Workspace",
  accountLabel = "",
  navGroups = [],
  activeKey = "",
  onNavigate,
  priorityLabel = "Current Priority",
  priorityText = "",
  children,
}) {
  const allItems = navGroups.flatMap((group) => group.items || []);
  const location = useLocation();
  const mainRef = useRef(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <>
      <NavBar />

      <div className="dashboard-shell">
        <aside className="dashboard-rail" aria-label={`${title} navigation`}>
          <div className="dashboard-rail-inner">
            <div className="dashboard-rail-head">
              <div className="dashboard-eyebrow">{eyebrow}</div>
              <div className="dashboard-rail-title">{title}</div>
              {accountLabel ? (
                <div className="dashboard-account">{accountLabel}</div>
              ) : null}
            </div>

            <nav className="dashboard-nav" aria-label="Dashboard sections">
              {navGroups.map((group) => (
                <div className="dashboard-nav-group" key={group.label}>
                  {group.label ? (
                    <div className="dashboard-nav-group-label">
                      {group.label}
                    </div>
                  ) : null}
                  <div className="dashboard-nav-items">
                    {(group.items || []).map((item) => (
                      <DashboardNavItem
                        key={item.key}
                        item={item}
                        active={activeKey === item.key}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            {priorityText ? (
              <div className="dashboard-rail-note">
                <div className="dashboard-rail-note-label">{priorityLabel}</div>
                <div className="dashboard-rail-note-text">{priorityText}</div>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="dashboard-main-shell" ref={mainRef}>
          <div className="dashboard-mobile-head">
            <div>
              <div className="dashboard-eyebrow">{eyebrow}</div>
              <div className="dashboard-mobile-title">{title}</div>
              {accountLabel ? (
                <div className="dashboard-account">{accountLabel}</div>
              ) : null}
            </div>
          </div>

          <div className="dashboard-mobile-nav" aria-label="Dashboard sections">
            {allItems.map((item) => (
              <DashboardNavItem
                key={item.key}
                item={item}
                compact
                active={activeKey === item.key}
                onNavigate={onNavigate}
              />
            ))}
          </div>

          <main className="dashboard-content">{children}</main>
        </section>
      </div>

      <style>{`
        .dashboard-shell{
          --dashboard-nav-height:70px;
          --dashboard-rail-width:286px;
          height:calc(100dvh - var(--dashboard-nav-height));
          min-height:0;
          display:grid;
          grid-template-columns:var(--dashboard-rail-width) minmax(0,1fr);
          overflow:hidden;
          background:
            linear-gradient(180deg, rgba(250,250,252,1) 0%, rgba(246,247,249,1) 100%);
          color:#0f172a;
        }

        .dashboard-rail{
          position:relative;
          height:100%;
          min-height:0;
          overflow:hidden;
          border-right:1px solid rgba(15,23,42,.09);
          background:
            linear-gradient(180deg, rgba(255,255,255,.92) 0%, rgba(248,250,252,.94) 100%);
        }

        .dashboard-rail-inner{
          height:100%;
          min-height:0;
          display:flex;
          flex-direction:column;
          padding:10px 16px 16px 22px;
          overflow:hidden;
        }

        .dashboard-rail-head{
          display:flex;
          flex-direction:column;
          justify-content:flex-start;
          padding:0 10px 14px;
          border-bottom:1px solid rgba(15,23,42,.08);
        }

        .dashboard-eyebrow{
          font-size:11px;
          font-weight:950;
          letter-spacing:.1em;
          text-transform:uppercase;
          color:rgba(15,23,42,.44);
        }

        .dashboard-rail-title,
        .dashboard-mobile-title{
          margin-top:8px;
          font-size:22px;
          line-height:1.1;
          font-weight:950;
          letter-spacing:-.03em;
          color:#0f172a;
        }

        .dashboard-account{
          margin-top:7px;
          font-size:12px;
          line-height:1.45;
          font-weight:750;
          color:rgba(15,23,42,.58);
          word-break:break-word;
        }

        .dashboard-nav{
          flex:1 1 auto;
          min-height:0;
          padding:14px 0;
          display:grid;
          gap:22px;
          overflow-y:auto;
          overscroll-behavior:contain;
          scrollbar-width:none;
        }

        .dashboard-nav::-webkit-scrollbar{
          width:0;
          height:0;
        }

        .dashboard-nav-group{
          display:grid;
          gap:8px;
        }

        .dashboard-nav-group-label{
          padding:0 10px;
          font-size:11px;
          font-weight:950;
          letter-spacing:.08em;
          text-transform:uppercase;
          color:rgba(15,23,42,.42);
        }

        .dashboard-nav-items{
          display:grid;
          gap:2px;
        }

        .dashboard-nav-item{
          width:100%;
          min-height:50px;
          border:0;
          border-left:3px solid transparent;
          border-radius:0 12px 12px 0;
          background:transparent;
          color:#0f172a;
          display:grid;
          grid-template-columns:minmax(0,1fr) auto;
          align-items:center;
          gap:10px;
          padding:9px 10px 9px 12px;
          text-align:left;
          cursor:pointer;
          transition:background .16s ease, color .16s ease, border-color .16s ease;
        }

        .dashboard-nav-item.has-icon{
          grid-template-columns:22px minmax(0,1fr) auto;
          padding-left:10px;
        }

        .dashboard-nav-icon{
          width:22px;
          height:22px;
          border-radius:8px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          color:rgba(15,23,42,.54);
        }

        .dashboard-nav-item.active .dashboard-nav-icon{
          color:#b42318;
          background:rgba(180,35,24,.08);
        }

        .dashboard-nav-item:hover{
          background:rgba(15,23,42,.045);
        }

        .dashboard-nav-item.active{
          border-left-color:#b42318;
          background:rgba(180,35,24,.075);
          color:#b42318;
        }

        .dashboard-nav-copy{
          min-width:0;
          display:grid;
          gap:3px;
        }

        .dashboard-nav-title{
          min-width:0;
          font-size:14px;
          line-height:1.2;
          font-weight:900;
          letter-spacing:-.01em;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .dashboard-nav-subtitle{
          min-width:0;
          font-size:12px;
          line-height:1.25;
          font-weight:700;
          color:rgba(15,23,42,.53);
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .dashboard-nav-item.active .dashboard-nav-subtitle{
          color:rgba(180,35,24,.68);
        }

        .dashboard-nav-badge{
          min-width:28px;
          height:22px;
          padding:0 8px;
          border-radius:999px;
          background:rgba(15,23,42,.07);
          color:rgba(15,23,42,.68);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          font-size:10px;
          font-weight:950;
          letter-spacing:.03em;
          text-transform:uppercase;
        }

        .dashboard-nav-item.active .dashboard-nav-badge{
          background:rgba(180,35,24,.12);
          color:#b42318;
        }

        .dashboard-rail-note{
          flex:0 0 auto;
          margin-top:auto;
          padding:12px 10px 0;
          border-top:1px solid rgba(15,23,42,.08);
        }

        .dashboard-rail-note-label{
          font-size:11px;
          font-weight:950;
          letter-spacing:.08em;
          text-transform:uppercase;
          color:rgba(15,23,42,.42);
        }

        .dashboard-rail-note-text{
          margin-top:8px;
          font-size:12px;
          line-height:1.65;
          font-weight:700;
          color:rgba(15,23,42,.58);
        }

        .dashboard-main-shell{
          min-width:0;
          min-height:0;
          height:100%;
          overflow-y:auto;
          overflow-x:hidden;
          overscroll-behavior:contain;
          scrollbar-gutter:stable;
          padding:24px 32px 48px;
        }

        .dashboard-content{
          width:min(100%, 1420px);
          min-width:0;
        }

        .dashboard-content,
        .dashboard-content *{
          box-sizing:border-box;
          min-width:0;
        }

        .dashboard-content img,
        .dashboard-content video,
        .dashboard-content canvas,
        .dashboard-content svg{
          max-width:100%;
        }

        .dashboard-content input,
        .dashboard-content select,
        .dashboard-content textarea,
        .dashboard-content button{
          max-width:100%;
        }

        .dashboard-mobile-head,
        .dashboard-mobile-nav{
          display:none;
        }

        @media (max-width:1100px){
          .dashboard-shell{
            display:block;
          }

          .dashboard-rail{
            display:none;
          }

          .dashboard-main-shell{
            height:100%;
            padding:18px 18px 42px;
          }

          .dashboard-mobile-head{
            display:flex;
            justify-content:space-between;
            align-items:flex-end;
            gap:16px;
            padding:2px 0 14px;
            border-bottom:1px solid rgba(15,23,42,.08);
          }

          .dashboard-mobile-nav{
            position:sticky;
            top:0;
            z-index:30;
            margin:0 -18px 18px;
            padding:10px 18px;
            display:flex;
            gap:8px;
            overflow-x:auto;
            border-bottom:1px solid rgba(15,23,42,.08);
            background:rgba(248,250,252,.94);
            backdrop-filter:blur(16px);
            -webkit-backdrop-filter:blur(16px);
          }

          .dashboard-nav-item.compact{
            width:auto;
            min-width:max-content;
            min-height:38px;
            grid-template-columns:minmax(0,1fr) auto;
            border-left:0;
            border-radius:999px;
            padding:8px 12px;
            border:1px solid rgba(15,23,42,.08);
            background:#fff;
          }

          .dashboard-nav-item.compact.has-icon{
            grid-template-columns:18px minmax(0,1fr) auto;
            padding-left:10px;
          }

          .dashboard-nav-item.compact .dashboard-nav-icon{
            width:18px;
            height:18px;
            border-radius:999px;
          }

          .dashboard-nav-item.compact.active{
            border-color:rgba(180,35,24,.18);
            background:rgba(180,35,24,.08);
          }

          .dashboard-nav-item.compact .dashboard-nav-title{
            font-size:13px;
          }

          .dashboard-content{
            width:100%;
          }
        }

        @media (max-width:640px){
          .dashboard-shell{
            --dashboard-nav-height:64px;
          }

          .dashboard-main-shell{
            padding:14px 14px 36px;
          }

          .dashboard-mobile-nav{
            margin-left:-14px;
            margin-right:-14px;
            padding-left:14px;
            padding-right:14px;
          }

          .dashboard-mobile-title{
            font-size:20px;
          }

          .dashboard-content [style*="repeat("],
          .dashboard-content [style*="minmax("]{
            grid-template-columns:1fr!important;
          }

          .dashboard-content [style*="display: flex"]{
            max-width:100%;
          }

          .dashboard-content button{
            min-width:0!important;
            white-space:normal;
          }
        }
      `}</style>
    </>
  );
}
