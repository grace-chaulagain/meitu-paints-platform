import { DashboardIcon } from "../../../../components/dashboard/DashboardIcons.jsx";

// Shared by every account-keeping section. Plain constants/style helpers
// live in sectionLayout.js so this file only exports components
// (react-refresh/only-export-components).
//
// PanelHead deliberately does NOT reuse DashboardUI's SectionHeader: that
// component is tuned for full-page headers, and at card scale its type
// sizes made every panel shout at the same volume as the page itself.
// This one establishes a quieter card-level hierarchy - a small tracked
// eyebrow, a confident title, and a hairline that separates head from
// body so charts and tables stop floating against the card edge.
export function PanelHead({ eyebrow, icon, title, action, subtitle = "" }) {
  return (
    <div className="iw-panel-head">
      <div className="iw-panel-head-text">
        {eyebrow ? (
          <div className="iw-panel-eyebrow">
            {icon ? <DashboardIcon name={icon} size={12} strokeWidth={2.2} /> : null}
            <span>{eyebrow}</span>
          </div>
        ) : null}
        <div className="iw-panel-title">{title}</div>
        {subtitle ? <div className="iw-panel-subtitle">{subtitle}</div> : null}
      </div>
      {action ? <div className="iw-panel-action">{action}</div> : null}

      <style>{`
        .iw-panel-head{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:12px;
          padding:16px 18px 13px;
          border-bottom:1px solid rgba(29,29,31,.06);
        }
        .iw-panel-head-text{ min-width:0; }
        .iw-panel-eyebrow{
          display:inline-flex; align-items:center; gap:5px;
          font-size:10.5px; font-weight:700; letter-spacing:.06em;
          text-transform:uppercase;
          color:var(--color-graphite, #707070);
          margin-bottom:4px;
        }
        .iw-panel-title{
          font-size:15px; font-weight:700; letter-spacing:-.01em;
          color:var(--color-ink, #1d1d1f);
          line-height:1.25;
        }
        .iw-panel-subtitle{
          margin-top:3px;
          font-size:12.5px; font-weight:500;
          color:var(--color-graphite, #707070);
        }
        .iw-panel-action{ flex:0 0 auto; }
        @media (max-width:560px){
          .iw-panel-head{ flex-direction:column; align-items:stretch; }
        }
      `}</style>
    </div>
  );
}

// Consistent inner padding for anything that isn't a chart (charts carry
// their own). Without this every section was re-declaring the same
// "0 18px 18px" by hand and drifting.
export function PanelBody({ children, pad = true }) {
  return <div style={{ padding: pad ? "14px 18px 18px" : 0 }}>{children}</div>;
}

export function ErrorBanner({ message }) {
  return (
    <div className="iw-error-banner">
      <DashboardIcon name="warning" size={15} strokeWidth={2} />
      <span>{message}</span>

      <style>{`
        .iw-error-banner{
          display:flex; align-items:center; gap:9px;
          padding:12px 14px;
          border-radius:14px;
          background:rgba(180,35,24,.07);
          border:1px solid rgba(180,35,24,.16);
          color:#b42318;
          font-size:13px;
          font-weight:600;
        }
      `}</style>
    </div>
  );
}
