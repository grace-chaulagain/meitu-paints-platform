import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import NavBar from "../NavBar.jsx";
import DashboardIcon from "./DashboardIcons.jsx";

function badgeText(value) {
  return value === null || value === undefined ? "" : String(value);
}

const DEFAULT_RAIL_WIDTH = 248;
const RAIL_COLLAPSE_KEY = "meitu_dashboard_rail_collapsed";

function readStoredRailCollapsed() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(RAIL_COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
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
          <DashboardIcon name={iconName} size={compact ? 17 : 16} strokeWidth={1.7} />
        </span>
      ) : null}
      <span className="dashboard-nav-title">{item.title}</span>
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
  children,
}) {
  const allItems = navGroups.flatMap((group) => group.items || []);
  const location = useLocation();
  const navigationType = useNavigationType();
  const mainRef = useRef(null);
  // Remembers each pathname's last scroll offset within this browser session so
  // that going "back" (e.g. from an order detail page to the orders list) restores
  // the list exactly where the admin left it, instead of always jumping to top.
  const scrollPositions = useRef(new Map());
  const railWidth = DEFAULT_RAIL_WIDTH;
  const [railCollapsed, setRailCollapsed] = useState(readStoredRailCollapsed);

  const toggleRail = useCallback(() => {
    setRailCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(RAIL_COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore write failures (e.g. private browsing storage quota)
      }
      return next;
    });
  }, []);

  const handleMainScroll = useCallback(() => {
    if (mainRef.current) {
      scrollPositions.current.set(location.pathname, mainRef.current.scrollTop);
    }
  }, [location.pathname]);

  useEffect(() => {
    const node = mainRef.current;
    if (!node) return;

    if (navigationType === "POP" && scrollPositions.current.has(location.pathname)) {
      node.scrollTo({ top: scrollPositions.current.get(location.pathname), left: 0, behavior: "auto" });
    } else if (navigationType !== "POP") {
      node.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [location.pathname, navigationType]);

  return (
    <>
      <NavBar />

      <div
        className={`dashboard-shell ${railCollapsed ? "rail-collapsed" : ""}`}
        style={{ "--dashboard-rail-width": `${railWidth}px` }}
      >
        <aside className="dashboard-rail" aria-label={`${title} navigation`} aria-hidden={railCollapsed}>
          <div className="dashboard-rail-inner">
            <div className="dashboard-rail-head">
              <div className="dashboard-rail-identity">
                <div className="dashboard-rail-title">{title}</div>
                <div className="dashboard-eyebrow">{eyebrow}</div>
              </div>
              <button
                type="button"
                className="dashboard-rail-toggle"
                onClick={toggleRail}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                tabIndex={railCollapsed ? -1 : 0}
              >
                <DashboardIcon name="chevron" size={13} strokeWidth={2.1} style={{ transform: "rotate(180deg)" }} />
              </button>
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

            {accountLabel ? (
              <div className="dashboard-account" title={accountLabel}>
                {accountLabel}
              </div>
            ) : null}
          </div>
        </aside>

        <button
          type="button"
          className="dashboard-rail-reveal"
          onClick={toggleRail}
          aria-label="Show sidebar"
          title="Show sidebar"
          tabIndex={railCollapsed ? 0 : -1}
        >
          <DashboardIcon name="chevron" size={13} strokeWidth={2.1} />
        </button>

        <section className="dashboard-main-shell" ref={mainRef} onScroll={handleMainScroll}>
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
          --dashboard-rail-width:248px;
          position:relative;
          height:calc(100dvh - var(--dashboard-nav-height));
          min-height:0;
          display:flex;
          align-items:stretch;
          overflow:hidden;
          background:
            radial-gradient(circle at 72% 6%, rgba(0,113,227,.08), transparent 28%),
            linear-gradient(180deg, #ffffff 0%, var(--color-fog,#f5f5f7) 42%, var(--color-fog,#f5f5f7) 100%);
          color:var(--color-ink,#1d1d1f);
          font-family:var(--font-sf-pro-text, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        }

        .dashboard-rail{
          position:relative;
          flex:0 0 var(--dashboard-rail-width);
          width:var(--dashboard-rail-width);
          height:100%;
          min-height:0;
          overflow:hidden;
          border-right:1px solid rgba(29,29,31,.08);
          background:rgba(255,255,255,.74);
          backdrop-filter:blur(24px);
          -webkit-backdrop-filter:blur(24px);
          transition:flex-basis .42s cubic-bezier(.32,.72,0,1), width .42s cubic-bezier(.32,.72,0,1), opacity .3s ease, border-color .3s ease;
        }

        .dashboard-shell.rail-collapsed .dashboard-rail{
          flex-basis:0;
          width:0;
          opacity:0;
          border-right-color:transparent;
        }

        .dashboard-rail-inner{
          width:var(--dashboard-rail-width);
          flex:0 0 auto;
          height:100%;
          min-height:0;
          display:flex;
          flex-direction:column;
          padding:18px 12px 14px;
          overflow:hidden;
        }

        .dashboard-rail-head{
          flex:0 0 auto;
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:6px;
          padding:4px 8px 18px;
        }

        .dashboard-rail-toggle{
          flex:0 0 auto;
          width:26px;
          height:26px;
          margin-top:2px;
          border:0;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          color:rgba(0,0,0,.42);
          background:rgba(29,29,31,.045);
          cursor:pointer;
          transition:background .16s ease, color .16s ease, transform .16s ease;
        }

        .dashboard-rail-toggle:hover{
          background:rgba(29,29,31,.09);
          color:var(--color-ink,#1d1d1f);
          transform:scale(1.05);
        }

        .dashboard-rail-toggle:active{
          transform:scale(.92);
        }

        .dashboard-rail-reveal{
          position:absolute;
          top:18px;
          left:14px;
          z-index:40;
          width:30px;
          height:30px;
          border:1px solid rgba(29,29,31,.08);
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          color:rgba(0,0,0,.5);
          background:rgba(255,255,255,.86);
          backdrop-filter:blur(16px);
          -webkit-backdrop-filter:blur(16px);
          box-shadow:0 6px 18px rgba(15,23,42,.1);
          cursor:pointer;
          opacity:0;
          transform:translateX(-8px) scale(.88);
          pointer-events:none;
          transition:opacity .3s ease, transform .38s cubic-bezier(.32,.72,0,1), background .16s ease, color .16s ease;
        }

        .dashboard-rail-reveal:hover{
          color:var(--color-ink,#1d1d1f);
          background:#fff;
        }

        .dashboard-shell.rail-collapsed .dashboard-rail-reveal{
          opacity:1;
          transform:translateX(0) scale(1);
          pointer-events:auto;
          transition-delay:.1s;
        }

        .dashboard-shell.rail-collapsed .dashboard-rail-reveal:active{
          transform:translateX(0) scale(.88);
        }

        .dashboard-rail-identity{
          min-width:0;
        }

        .dashboard-eyebrow{
          margin-top:2px;
          font-size:10.5px;
          line-height:1.3;
          font-weight:700;
          letter-spacing:.08em;
          text-transform:uppercase;
          color:rgba(0,0,0,.4);
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .dashboard-rail-title{
          font-size:17px;
          line-height:1.18;
          font-weight:800;
          letter-spacing:-.03em;
          color:var(--color-ink,#1d1d1f);
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .dashboard-mobile-title{
          margin-top:8px;
          font-size:24px;
          line-height:1.1;
          font-weight:800;
          letter-spacing:-.03em;
          color:var(--color-ink,#1d1d1f);
        }

        .dashboard-account{
          flex:0 0 auto;
          margin-top:12px;
          padding:12px 10px 3px;
          border-top:1px solid rgba(29,29,31,.08);
          font-size:11.5px;
          line-height:1.4;
          font-weight:500;
          color:rgba(0,0,0,.4);
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .dashboard-nav{
          flex:1 1 auto;
          min-height:0;
          padding:2px 0;
          display:grid;
          align-content:start;
          gap:20px;
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
          align-content:start;
          gap:2px;
        }

        .dashboard-nav-group-label{
          padding:0 10px 7px;
          font-size:10.5px;
          font-weight:800;
          letter-spacing:.08em;
          text-transform:uppercase;
          color:rgba(0,0,0,.38);
        }

        .dashboard-nav-items{
          display:grid;
          align-content:start;
          gap:3px;
        }

        .dashboard-nav-item{
          width:100%;
          min-height:38px;
          border:0;
          border-radius:14px;
          background:transparent;
          color:var(--color-ink,#1d1d1f);
          display:grid;
          grid-template-columns:minmax(0,1fr) auto;
          align-items:center;
          gap:9px;
          padding:8px 10px;
          text-align:left;
          cursor:pointer;
          transition:background .16s ease, color .16s ease, transform .16s ease;
        }

        .dashboard-nav-item.has-icon{
          grid-template-columns:24px minmax(0,1fr) auto;
        }

        .dashboard-nav-icon{
          width:24px;
          height:24px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          color:rgba(0,0,0,.5);
          background:rgba(29,29,31,.045);
          transition:background .16s ease, color .16s ease;
        }

        .dashboard-nav-item.active .dashboard-nav-icon{
          color:var(--color-azure,#0071e3);
          background:rgba(0,113,227,.1);
        }

        .dashboard-nav-item:hover{
          background:rgba(29,29,31,.045);
          transform:translateX(1px);
        }

        .dashboard-nav-item.active{
          background:rgba(0,113,227,.1);
          color:var(--color-azure,#0071e3);
        }

        .dashboard-nav-item.active:hover{
          background:rgba(0,113,227,.16);
        }

        .dashboard-nav-title{
          min-width:0;
          font-size:13.5px;
          line-height:1.3;
          font-weight:600;
          letter-spacing:-.01em;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .dashboard-nav-item.active .dashboard-nav-title{
          font-weight:600;
        }

        .dashboard-nav-badge{
          min-width:18px;
          height:18px;
          padding:0 6px;
          border-radius:999px;
          background:rgba(29,29,31,.07);
          color:rgba(0,0,0,.5);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          font-size:10px;
          font-weight:600;
        }

        .dashboard-nav-item.active .dashboard-nav-badge{
          background:rgba(0,113,227,.16);
          color:var(--color-azure,#0071e3);
        }

        .dashboard-main-shell{
          flex:1 1 auto;
          min-width:0;
          min-height:0;
          height:100%;
          overflow-y:auto;
          overflow-x:hidden;
          overscroll-behavior:contain;
          scrollbar-gutter:stable;
          padding:28px 34px 52px;
        }

        .dashboard-content{
          width:min(100%, 1480px);
          min-width:0;
          /* fill-mode is "backwards" (not "both") on purpose: retaining the
             final keyframe's transform after the animation ends would make
             this the CSS containing block for any descendant position:fixed
             modal, positioning it relative to this (page-content-height-tall)
             box instead of the viewport. "backwards" avoids an initial flash
             without leaving a stray transform behind once the animation completes. */
          animation:dashboardContentIn .34s cubic-bezier(.2,.7,.3,1) backwards;
        }

        @keyframes dashboardContentIn{
          from{ opacity:0; transform:translateY(7px); }
          to{ opacity:1; transform:translateY(0); }
        }

        @media (prefers-reduced-motion: reduce){
          .dashboard-content{ animation:none; }
          .dashboard-rail,
          .dashboard-rail-reveal{ transition:none; }
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

          .dashboard-rail-reveal{
            display:none;
          }

          .dashboard-sidebar-return{
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
            padding:4px 0 14px;
            border-bottom:1px solid rgba(29,29,31,.08);
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
            border-bottom:1px solid rgba(29,29,31,.08);
            background:rgba(255,255,255,.82);
            backdrop-filter:blur(22px);
            -webkit-backdrop-filter:blur(22px);
          }

          .dashboard-nav-item.compact{
            width:auto;
            min-width:max-content;
            min-height:38px;
            grid-template-columns:minmax(0,1fr) auto;
            border-left:0;
            border-radius:999px;
            padding:8px 12px;
            border:1px solid rgba(29,29,31,.08);
            background:rgba(255,255,255,.9);
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
            border-color:rgba(0,113,227,.22);
            background:rgba(0,113,227,.08);
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
