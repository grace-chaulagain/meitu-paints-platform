import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import NavBar from "../NavBar.jsx";
import DashboardIcon from "./DashboardIcons.jsx";
import DashboardMobileNavDrawer from "./DashboardMobileNavDrawer.jsx";

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

function numericBadge(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function DashboardShell({
  title,
  eyebrow = "Workspace",
  accountLabel = "",
  navGroups = [],
  activeKey = "",
  onNavigate,
  // Opt-in: hides the mobile chevron trigger + this shell's own nav drawer.
  // Only the dealer mobile redesign passes this (it renders its own bottom
  // tab bar + "More" drawer instead) - every other role leaves this
  // unset and keeps today's exact behavior.
  hideMobileTopbar = false,
  // Opt-in: adds a "dealer-mobile-bleed" class to the shell root, letting
  // DealerMobileStyles.jsx zero out .dashboard-main-shell's own horizontal
  // padding so dealer-mobile pages can own a single gutter (their own
  // padding-inline) instead of stacking on top of the shell's. Every other
  // role leaves this unset and keeps today's padding exactly as-is.
  mobileBleed = false,
  children,
}) {
  const allNavItems = navGroups.flatMap((group) => group.items || []);
  const totalNavBadge = allNavItems.reduce((sum, item) => sum + numericBadge(item.badge), 0);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
        className={`dashboard-shell ${railCollapsed ? "rail-collapsed" : ""} ${mobileBleed ? "dealer-mobile-bleed" : ""}`}
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
          {hideMobileTopbar ? null : (
            <div className="dashboard-mobile-topbar">
              <button
                type="button"
                className="dashboard-mobile-menu-btn"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open dashboard menu"
              >
                <DashboardIcon name="chevron" size={15} strokeWidth={2.2} />
                {totalNavBadge ? <span className="dashboard-mobile-menu-badge">{totalNavBadge}</span> : null}
              </button>
            </div>
          )}

          <main className="dashboard-content">{children}</main>
        </section>
      </div>

      <DashboardMobileNavDrawer
        open={!hideMobileTopbar && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={title}
        eyebrow={eyebrow}
        accountLabel={accountLabel}
        groups={navGroups}
        activeKey={activeKey}
        onNavigate={(item) => {
          onNavigate?.(item);
          setDrawerOpen(false);
        }}
      />

      <style>{`
        .dashboard-shell{
          --dashboard-nav-height:70px;
          --dashboard-rail-width:248px;
          position:relative;
          /* svh (small viewport height), not dvh - dvh is meant to live-update
             as Safari's address bar hides/shows, but iOS has real, documented
             bugs where it computes against a transient mid-animation viewport
             size (e.g. during a pull-to-refresh gesture) and doesn't settle
             back down afterward, leaving this shell - and the gap above its
             scrollable content - sized against a taller-than-real viewport.
             svh always uses the smallest possible viewport (chrome fully
             expanded), so it can't get stuck on a stale larger reading - the
             only cost is not reclaiming the extra strip Safari shows once its
             chrome auto-hides, which is a fine trade for never glitching. */
          height:calc(100svh - var(--dashboard-nav-height));
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

        .dashboard-shell button,
        .dashboard-shell a{
          -webkit-tap-highlight-color:transparent;
        }

        .dashboard-mobile-topbar{
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

          .dashboard-mobile-topbar{
            position:sticky;
            top:10px;
            z-index:30;
            display:flex;
            align-items:center;
            width:max-content;
            margin-bottom:8px;
          }

          .dashboard-mobile-menu-btn{
            position:relative;
            width:36px;
            height:36px;
            flex-shrink:0;
            border-radius:999px;
            border:1px solid rgba(29,29,31,.08);
            background:rgba(255,255,255,.9);
            backdrop-filter:blur(16px);
            -webkit-backdrop-filter:blur(16px);
            box-shadow:0 6px 18px rgba(15,23,42,.1);
            display:grid;
            place-items:center;
            color:var(--color-ink,#1d1d1f);
            cursor:pointer;
            transition:background .16s ease, transform .1s ease-out;
          }

          .dashboard-mobile-menu-btn:active{
            transform:scale(.94);
          }

          .dashboard-mobile-menu-badge{
            position:absolute;
            top:-3px;
            right:-3px;
            min-width:16px;
            height:16px;
            padding:0 4px;
            border-radius:999px;
            background:var(--color-azure,#0071e3);
            color:#fff;
            font-size:9.5px;
            font-weight:800;
            display:grid;
            place-items:center;
            border:2px solid #fff;
          }

          /* iOS Safari auto-zooms on focus for inputs under 16px, on iPad as
             well as iPhone - DESIGN.md's compact 13-13.5px scale is
             intentional on desktop, so this rides the same <=1100px
             breakpoint that already switches the whole shell into its
             mobile-nav presentation, rather than a separate/global bump. */
          .dashboard-content input,
          .dashboard-content select,
          .dashboard-content textarea{
            font-size:16px;
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
