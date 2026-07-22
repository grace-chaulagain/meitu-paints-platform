// Shared/core <style> block for every dealer/mobile/* component -
// design tokens, generic primitives (SegmentedControl, LargeTitleHeader,
// MobileToast, AppleSpinner, PrimaryButton, StatusChip/Rail,
// QuantityStepper, TierProgressBar, MobilePushHeader, BottomTabBar,
// CartPill, MovementCardList) and the generic mobile-screen helpers
// (skeleton/empty/error states) shared across every screen. Split from
// the original single DealerMobileStyles.jsx once it passed ~2000 lines
// (spec §6) - page-specific CSS lives in DealerMobileStyles.pages.jsx.
// Both are rendered together, once, from DealerDashboardPage.jsx.
export function DealerMobileStylesCore() {
  return (
    <style>{`
      /* ---- V2 §1.1: single-gutter system ----
         DashboardShell's own .dashboard-main-shell padding (18px/1100px,
         14px/640px) previously stacked with every dealer-m-* page's own
         padding, leaving ~34px/side of dead margin on a 390px screen.
         DashboardShell now accepts an opt-in mobileBleed prop (dealer pages
         only) that adds this .dealer-mobile-bleed class - zero out the
         shell's own horizontal padding here so pages own a single gutter.
         !important: this style tag renders inside .dashboard-content,
         earlier in document order than DashboardShell's own trailing
         <style> block, which would otherwise win the cascade tie. */
      :root{ --dealer-m-gutter: 16px; }
      .dashboard-shell.dealer-mobile-bleed .dashboard-main-shell{
        padding-left:0 !important;
        padding-right:0 !important;
      }

      /* ---- Animation constitution (V2 §3) - the four tokens every
         transition in this file must use. ---- */
      :root{
        --ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);
        --ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1);
        --ease-sheet: cubic-bezier(0.32, 0.72, 0, 1);
        --ease-bounce-subtle: cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      /* ---- V3 §3: type scale (~15% smaller than the original V1/V2
         scale, tokenized so the next pass is one line, not 120 edits).
         Every font-size in this file and DealerMobileStyles.pages.jsx
         should reference one of these - the only literal px font-sizes
         left anywhere are the deliberate exceptions (inputs/textareas,
         commitment-moment totals, tab bar labels - see V3 spec §3). ---- */
      :root{
        --t-hero: 29px;
        --t-title1: 24px;
        --t-title2: 20px;
        --t-title3: 19px;
        --t-headline: 17px;
        --t-body-lg: 14.5px;
        --t-body: 13.5px;
        --t-callout: 13px;
        --t-subhead: 12px;
        --t-footnote: 11px;
        --t-caption: 10.5px;
        --t-caption2: 10px;
      }

      /* ---- MobileToast ---- */
      .dealer-m-toast{
        position:fixed;
        left:16px;
        right:16px;
        bottom:calc(64px + env(safe-area-inset-bottom, 0px) + 12px);
        z-index:1800;
        max-width:calc(100% - 32px);
        margin:0 auto;
        background:var(--color-ink,#1d1d1f);
        color:#fff;
        border-radius:999px;
        padding:12px 18px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        font-size:var(--t-subhead);
        font-weight:500;
        opacity:0;
        transform:translateY(16px) scale(.97);
        transition:transform 200ms ease-out, opacity 200ms ease-out;
        box-shadow:0 10px 30px rgba(0,0,0,.22);
      }
      .dealer-m-toast[data-enter="true"]{
        transition:transform 350ms var(--ease-sheet,ease), opacity 350ms var(--ease-sheet,ease);
      }
      .dealer-m-toast.visible{
        opacity:1;
        transform:translateY(0) scale(1);
      }
      .dealer-m-toast-text{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      /* V3 §4: a trailing action (e.g. "Undo") - scoped to .has-action so
         the common no-action toast keeps its existing centered layout
         untouched. */
      .dealer-m-toast.has-action{
        justify-content:space-between;
        padding-right:14px;
      }
      .dealer-m-toast.has-action .dealer-m-toast-text{
        flex:1 1 auto;
        min-width:0;
      }
      .dealer-m-toast-action{
        flex-shrink:0;
        border:none;
        background:none;
        color:var(--color-azure,#0071e3);
        font-size:var(--t-subhead);
        font-weight:700;
        cursor:pointer;
        padding:4px 0 4px 12px;
      }
      .dealer-m-toast-action:active{ opacity:0.6; }

      /* ---- SegmentedControl ---- */
      .dealer-m-segmented{
        position:relative;
        display:grid;
        grid-template-columns:repeat(var(--dealer-m-segment-count), 1fr);
        background:var(--color-fog,#f5f5f7);
        border-radius:10px;
        padding:2px;
      }
      .dealer-m-segmented-thumb{
        position:absolute;
        top:2px; left:2px; bottom:2px;
        width:calc((100% - 4px) / var(--dealer-m-segment-count));
        background:var(--color-snow,#fff);
        border-radius:8px;
        box-shadow:0 1px 3px rgba(0,0,0,.1);
        transition:transform 250ms var(--ease-sheet,ease);
        z-index:0;
      }
      .dealer-m-segmented-item{
        position:relative;
        z-index:1;
        border:none;
        background:transparent;
        padding:8px 1px;
        font-size:var(--t-footnote);
        font-weight:600;
        letter-spacing:-.1px;
        font-variant-numeric:tabular-nums;
        color:var(--color-graphite,#707070);
        cursor:pointer;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
        transition:color 150ms ease, transform 120ms var(--ease-out-strong,ease);
      }
      .dealer-m-segmented-item:active{ transform:scale(.96); }
      .dealer-m-segmented-item.active{ color:var(--color-ink,#1d1d1f); }
      .dealer-m-segmented-count{
        margin-left:2px;
        font-size:var(--t-caption2);
        font-weight:500;
        opacity:.62;
      }
      /* DashboardShell's own mobile stylesheet has a .dashboard-content
         button{ white-space:normal } rule (added for the Admin dashboard's
         cramped action buttons) that outranks the single-class selector
         above on specificity alone - without this two-class override, a
         label+count pair like "Completed 44" wraps onto two lines instead
         of staying the single-line pill the spec calls for. */
      .dashboard-content .dealer-m-segmented-item{
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      /* ---- LargeTitleHeader ---- */
      /* iOS large-title collapse (spec §2.1), shared by Home/Browse/Orders.
         The compact header is always position:sticky at top:0 with its own
         flow height cancelled via a matching negative margin, so it never
         pushes the big title down before any scrolling happens - only its
         --collapse-driven opacity/transform change on scroll. */
      .dealer-m-compact-header{
        position:sticky;
        top:0;
        z-index:60;
        height:44px;
        margin-bottom:-44px;
        margin-inline:calc(var(--dealer-m-gutter) * -1);
        padding-inline:var(--dealer-m-gutter);
        display:flex;
        align-items:center;
        justify-content:center;
        background:rgba(245,245,247,.82);
        -webkit-backdrop-filter:saturate(180%) blur(20px);
        backdrop-filter:saturate(180%) blur(20px);
        border-bottom:1px solid rgba(29,29,31,.08);
        opacity:var(--collapse, 0);
        pointer-events:none;
        gap:6px;
      }
      .dealer-m-compact-header-title{
        font-size:var(--t-body-lg);
        font-weight:600;
        color:var(--color-ink,#1d1d1f);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        flex-shrink:1;
      }
      /* V3 §5.7: quiet orientation once the large title has scrolled out of
         view - which filter/query is active, right next to the pinned
         title. The leading dot ties it typographically to the title
         ("Orders · Active · 2") without needing a second string prop. */
      .dealer-m-compact-header-context{
        font-size:var(--t-footnote);
        font-weight:500;
        color:var(--color-graphite,#707070);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        flex-shrink:0;
        max-width:40%;
      }
      .dealer-m-compact-header-context::before{
        content:"·";
        margin-right:6px;
        opacity:.6;
      }
      /* V3 §2: the compact header itself stays pointer-events:none (it's
         mostly decorative chrome once pinned) - the trailing slot opts back
         into pointer-events:auto since it's the one interactive thing in
         it. Positioned absolutely within the sticky header rather than as a
         flex sibling, so it doesn't disturb the title's own centering. */
      .dealer-m-compact-header-trailing{
        position:absolute;
        right:var(--dealer-m-gutter);
        top:50%;
        transform:translateY(-50%);
        pointer-events:auto;
      }
      .dealer-m-large-title-group{
        position:relative;
        z-index:1;
        opacity:calc(1 - var(--collapse, 0));
        transform:translateY(calc(var(--collapse, 0) * -6px));
      }
      .dealer-m-large-title-eyebrow{
        font-size:var(--t-footnote);
        font-weight:600;
        letter-spacing:.06em;
        text-transform:uppercase;
        color:var(--color-graphite,#707070);
        margin-bottom:4px;
      }
      .dealer-m-large-title-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
      }
      .dealer-m-large-title{
        flex:1 1 auto;
        min-width:0;
        font-size:var(--t-hero);
        font-weight:700;
        letter-spacing:-0.02em;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-large-title-medium{ font-size:var(--t-title1); }
      .dealer-m-large-title-trailing{ flex-shrink:0; }
      .dealer-m-sticky-under-header{
        position:sticky;
        top:44px;
        z-index:55;
        margin-top:14px;
        margin-inline:calc(var(--dealer-m-gutter) * -1);
        padding:8px var(--dealer-m-gutter);
        background:rgba(245,245,247,var(--collapse, 0));
        -webkit-backdrop-filter:saturate(180%) blur(20px);
        backdrop-filter:saturate(180%) blur(20px);
      }

      /* ---- MovementCardList (spec §4.1, shared by Inventory list +
         detail) ---- */
      .dealer-m-movement-list{ display:flex; flex-direction:column; gap:22px; }
      .dealer-m-movement-day{ display:flex; flex-direction:column; gap:10px; }
      .dealer-m-movement-day-label{
        font-size:var(--t-footnote);
        font-weight:700;
        letter-spacing:.02em;
        text-transform:uppercase;
        color:var(--color-graphite,#707070);
      }
      .dealer-m-movement-card{
        display:flex;
        align-items:center;
        gap:12px;
        padding:12px 14px;
        border-radius:16px;
        background:var(--color-snow,#fff);
      }
      .dealer-m-movement-icon{
        width:36px; height:36px;
        border-radius:999px;
        display:grid;
        place-items:center;
        flex-shrink:0;
        background:var(--color-fog,#f5f5f7);
        color:var(--color-graphite,#707070);
      }
      .dealer-m-movement-icon.in{ background:rgba(22,163,74,.1); color:#15803d; }
      .dealer-m-movement-icon.out{ background:rgba(180,35,24,.1); color:#b42318; }
      .dealer-m-movement-thumb{
        width:36px; height:36px;
        border-radius:10px;
        display:grid;
        place-items:center;
        overflow:hidden;
        flex-shrink:0;
        background:var(--color-fog,#f5f5f7);
        color:var(--color-graphite,#707070);
      }
      .dealer-m-movement-thumb img{ width:100%; height:100%; object-fit:cover; }
      .dealer-m-movement-body{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
      .dealer-m-movement-title{
        font-size:var(--t-subhead);
        font-weight:600;
        color:var(--color-ink,#1d1d1f);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .dealer-m-movement-sub{ font-size:var(--t-caption); color:var(--color-graphite,#707070); }
      .dealer-m-movement-right{ flex-shrink:0; display:flex; flex-direction:column; align-items:flex-end; gap:2px; }
      .dealer-m-movement-delta{ font-size:var(--t-subhead); font-weight:700; font-variant-numeric:tabular-nums; }
      .dealer-m-movement-delta.in{ color:#15803d; }
      .dealer-m-movement-delta.out{ color:#b42318; }
      .dealer-m-movement-balance{ font-size:var(--t-caption2); color:var(--color-graphite,#707070); font-variant-numeric:tabular-nums; }

      /* ---- AppleSpinner ---- */
      .dealer-m-apple-spinner{
        animation:appleSpinnerRotate 0.8s linear infinite;
      }
      @keyframes appleSpinnerRotate{
        from{ transform:rotate(0deg); }
        to{ transform:rotate(360deg); }
      }

      /* ---- PrimaryButton ---- */
      .dealer-m-primary-btn{
        position:relative;
        width:100%;
        min-height:52px;
        padding:6px 16px;
        border:none;
        border-radius:14px;
        background:var(--color-azure,#0071e3);
        color:#fff;
        /* Commitment-moment total (V3 §3 exception) - the cart/sheet
           footer CTA's price stays at its current literal size, never
           tokenized down; decision-critical numbers stay big. */
        font-size:17px;
        font-weight:600;
        cursor:pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        transition:transform 120ms var(--ease-out-strong,ease), filter 120ms ease;
      }
      .dealer-m-primary-btn:active:not(:disabled){
        transform:scale(.98);
        filter:brightness(.92);
      }
      .dealer-m-primary-btn:disabled{
        background:var(--color-fog,#f5f5f7);
        color:var(--color-graphite,#707070);
        cursor:not-allowed;
      }
      .dealer-m-primary-btn-secondary{
        background:var(--color-snow,#fff);
        color:var(--color-ink,#1d1d1f);
        border:1.5px solid rgba(29,29,31,.14);
      }
      .dealer-m-primary-btn-secondary:active:not(:disabled){
        filter:none;
        background:var(--color-fog,#f5f5f7);
      }
      .dealer-m-primary-btn-danger{
        background:#b42318;
      }
      .dealer-m-primary-btn-content{
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:2px;
        transition:opacity 120ms ease;
      }
      .dealer-m-primary-btn-label{ line-height:1.2; white-space:nowrap; }
      .dealer-m-primary-btn-subtext{
        font-size:var(--t-caption);
        font-weight:500;
        color:rgba(255,255,255,.7);
      }
      .dealer-m-primary-btn-secondary .dealer-m-primary-btn-subtext{
        color:var(--color-graphite,#707070);
      }
      .dealer-m-primary-btn-spinner{
        position:absolute;
        inset:0;
        display:grid;
        place-items:center;
      }

      /* ---- StatusChip ---- */
      .dealer-m-status-chip{
        display:inline-flex;
        align-items:center;
        height:22px;
        padding:0 8px;
        border-radius:6px;
        font-size:var(--t-caption);
        font-weight:600;
        white-space:nowrap;
      }

      /* ---- StatusRail ---- */
      .dealer-m-status-rail{
        display:flex;
        align-items:flex-start;
        width:100%;
      }
      .dealer-m-status-rail-node{
        position:relative;
        flex:1;
        display:flex;
        flex-direction:column;
        align-items:center;
      }
      .dealer-m-status-rail-dot{
        width:14px;
        height:14px;
        border-radius:999px;
        display:grid;
        place-items:center;
        color:#fff;
        position:relative;
        z-index:1;
        flex-shrink:0;
      }
      .dealer-m-status-rail-lg .dealer-m-status-rail-dot{ width:22px; height:22px; }
      .dealer-m-status-rail-dot-done{ background:var(--color-ink,#1d1d1f); }
      .dealer-m-status-rail-dot-current{
        background:var(--color-azure,#0071e3);
        animation:dealerRailPulse 2s ease-in-out infinite;
      }
      .dealer-m-status-rail-dot-upcoming{
        background:#fff;
        border:1.5px solid var(--color-silver-mist,#e8e8ed);
      }
      @keyframes dealerRailPulse{
        0%,100%{ box-shadow:0 0 0 0 rgba(0,113,227,.35); }
        50%{ box-shadow:0 0 0 6px rgba(0,113,227,0); }
      }
      .dealer-m-status-rail-line{
        position:absolute;
        top:6px;
        left:50%;
        width:100%;
        height:2px;
        z-index:0;
      }
      .dealer-m-status-rail-lg .dealer-m-status-rail-line{ top:10px; }
      .dealer-m-status-rail-line-done{ background:var(--color-ink,#1d1d1f); }
      .dealer-m-status-rail-line-pending{ background:var(--color-silver-mist,#e8e8ed); }
      .dealer-m-status-rail-label{
        margin-top:8px;
        font-size:var(--t-caption2);
        font-weight:600;
        color:var(--color-graphite,#707070);
        text-align:center;
      }
      /* V3 §5.3: progressive fill on order-detail's "lg" rail only - mirrors
         .dealer-m-orders-card-stagger's index-based animation-delay
         pattern (DealerMobileStyles.pages.jsx), just applied to a rail
         node instead of a list card. Once per mount, never replays. */
      .dealer-m-status-rail-node-stagger{
        animation:dealerStatusRailNodeIn 320ms var(--ease-out-strong, ease-out) both;
      }
      @keyframes dealerStatusRailNodeIn{
        from{ opacity:0; transform:translateY(6px); }
        to{ opacity:1; transform:translateY(0); }
      }

      /* ---- QuantityStepper ---- */
      .dealer-m-stepper{
        display:inline-flex;
        align-items:center;
        gap:10px;
      }
      .dealer-m-stepper-btn{
        width:var(--dealer-m-stepper-size);
        height:var(--dealer-m-stepper-size);
        border-radius:999px;
        border:1px solid rgba(29,29,31,.1);
        background:var(--color-fog,#f5f5f7);
        color:var(--color-ink,#1d1d1f);
        display:grid;
        place-items:center;
        cursor:pointer;
        flex-shrink:0;
        transition:transform .1s ease-out, background .12s ease;
      }
      .dealer-m-stepper-btn:active:not(:disabled){ transform:scale(.92); background:rgba(29,29,31,.08); }
      .dealer-m-stepper-btn:disabled{ opacity:.35; cursor:not-allowed; }
      /* V3 §4.2: minus->trash crossfade, same stacked-opacity technique as
         BottomTabBar.jsx's TabGlyph (two icons on one grid cell, opacity
         toggled by state, 150ms transition) - not a keyframe, since the
         value can tick up/down repeatedly (long-press repeat) and a
         transition retargets smoothly on every change instead of restarting. */
      .dealer-m-stepper-icon-crossfade{ position:relative; display:grid; place-items:center; }
      .dealer-m-stepper-icon-crossfade svg{ grid-area:1/1; transition:opacity 150ms var(--ease-out-strong, ease-out); }
      .dealer-m-stepper-value{
        min-width:22px;
        text-align:center;
        font-size:var(--t-callout);
        font-weight:700;
        font-variant-numeric:tabular-nums;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-stepper-lg .dealer-m-stepper-value{ min-width:32px; font-size:var(--t-title2); font-weight:700; }

      /* ---- TierProgressBar ---- */
      .dealer-m-tier-nudge{
        margin-top:8px;
        padding:10px 12px;
        border-radius:12px;
        background:rgba(0,113,227,.08);
      }
      .dealer-m-tier-nudge-text{
        font-size:var(--t-footnote);
        font-weight:500;
        color:var(--color-ink,#1d1d1f);
        line-height:1.4;
      }
      .dealer-m-tier-nudge-text strong{ font-weight:700; }
      .dealer-m-tier-nudge-track{
        margin-top:8px;
        height:4px;
        border-radius:999px;
        background:rgba(0,113,227,.15);
        overflow:hidden;
      }
      .dealer-m-tier-nudge-fill{
        width:100%;
        height:100%;
        background:var(--color-azure,#0071e3);
        border-radius:999px;
        transform-origin:left;
        transform:scaleX(0);
        transition:transform .3s var(--ease-out,ease);
      }
      .dealer-m-tier-ladder{ margin-top:14px; }
      .dealer-m-tier-ladder-track{
        position:relative;
        height:6px;
        border-radius:999px;
        background:var(--color-fog,#f5f5f7);
      }
      .dealer-m-tier-ladder-fill{
        position:absolute;
        inset:0;
        border-radius:999px;
        background:var(--color-azure,#0071e3);
        transform-origin:left;
        transform:scaleX(0);
        transition:transform .3s var(--ease-out,ease);
      }
      .dealer-m-tier-ladder-tick{
        position:absolute;
        top:-3px;
        width:2px;
        height:12px;
        background:#fff;
        border-radius:1px;
      }
      .dealer-m-tier-ladder-price{
        margin-top:8px;
        font-size:var(--t-callout);
        font-weight:700;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-tier-ladder-caption{
        margin-top:2px;
        font-size:var(--t-caption);
        color:var(--color-graphite,#707070);
      }
      /* V3 §5.2: tier-crossing celebration - pulses the whole track (not
         the fill itself, which already owns its own inline scaleX() for
         the live fill width - animating a sibling property on the same
         element would fight that) and blur-crossfades the price label in
         on remount (TierProgressBar.jsx keys it by activeTier.min). */
      @keyframes dealerTierFillPulse{
        0%, 100%{ transform:scale(1); }
        50%{ transform:scale(1.03); }
      }
      .dealer-m-tier-ladder-track.dealer-m-tier-pulse{
        animation:dealerTierFillPulse .3s var(--ease-in-out,ease);
      }
      @keyframes dealerTierPriceCrossfade{
        from{ opacity:0; filter:blur(2px); }
        to{ opacity:1; filter:blur(0); }
      }
      .dealer-m-tier-ladder-price.dealer-m-tier-price-crossfade{
        animation:dealerTierPriceCrossfade .2s var(--ease-out,ease) both;
      }
      @media (prefers-reduced-motion: reduce){
        .dealer-m-tier-ladder-track.dealer-m-tier-pulse,
        .dealer-m-tier-ladder-price.dealer-m-tier-price-crossfade{
          animation:none;
        }
      }

      /* ---- MobilePushHeader ---- */
      .dealer-m-push-header{
        display:flex;
        align-items:center;
        height:44px;
        gap:8px;
      }
      .dealer-m-push-back{
        width:34px;
        height:34px;
        flex-shrink:0;
        border-radius:999px;
        border:none;
        background:var(--color-fog,#f5f5f7);
        color:var(--color-ink,#1d1d1f);
        display:grid;
        place-items:center;
        cursor:pointer;
        transition:transform 120ms ease-out;
      }
      .dealer-m-push-back:active{ transform:scale(0.92); }
      .dealer-m-push-title{
        flex:1;
        min-width:0;
        text-align:center;
        font-size:var(--t-body-lg);
        font-weight:600;
        color:var(--color-ink,#1d1d1f);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .dealer-m-push-action{
        flex-shrink:0;
        min-width:34px;
        display:flex;
        justify-content:flex-end;
      }

      /* ---- BottomTabBar ---- */
      .dealer-m-tabbar{
        position:fixed;
        left:0;
        right:0;
        bottom:0;
        z-index:1500;
        display:flex;
        height:64px;
        padding-bottom:env(safe-area-inset-bottom, 0px);
        background:var(--color-snow,#fff);
        border-top:.5px solid var(--color-silver-mist,#e8e8ed);
      }
      .dealer-m-tabbar-item{
        flex:1;
        border:none;
        background:transparent;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:3px;
        color:var(--color-graphite,#707070);
        cursor:pointer;
        transition:transform 120ms ease-out;
      }
      .dealer-m-tabbar-item:active{ transform:scale(0.96); }
      .dealer-m-tabbar-item.active{ color:var(--color-azure,#0071e3); }
      .dealer-m-tabbar-icon-wrap{ position:relative; display:grid; place-items:center; }
      .dealer-m-tabbar-icon-crossfade{ position:relative; display:grid; place-items:center; width:24px; height:24px; }
      .dealer-m-tabbar-icon-crossfade svg{ grid-area:1/1; transition:opacity 150ms var(--ease-out-strong, ease-out); }
      .dealer-m-tabbar-icon-bounce{ animation:dealerTabBounce 300ms var(--ease-bounce-subtle, cubic-bezier(0.34,1.56,0.64,1)); }
      @keyframes dealerTabBounce{
        0%{ transform:scale(1); }
        40%{ transform:scale(0.85); }
        100%{ transform:scale(1); }
      }
      .dealer-m-tabbar-dot{
        position:absolute;
        top:-1px;
        right:-3px;
        width:7px;
        height:7px;
        border-radius:999px;
        background:var(--color-azure,#0071e3);
        border:1.5px solid var(--color-snow,#fff);
      }
      .dealer-m-tabbar-label{
        /* V3 §3 exception - already at the intended floor, left untouched. */
        font-size:10.5px;
        font-weight:500;
      }
      .dealer-m-tabbar-item.active .dealer-m-tabbar-label{ font-weight:600; }

      /* ---- CartPill ---- */
      /* Always mounted (see CartPill.jsx) - a constant 48px pill whose
         appearance/disappearance is a plain opacity+transform transition on
         .visible, never a keyframe/DOM remount. That's deliberate: itemCount
         crosses the 0/1 boundary often now that quantity taps live-commit,
         and a transition just retargets smoothly however often that happens
         mid-flight, where a keyframe would restart from zero every time and
         read as a jittery double-pop. Also deliberately a fixed height with
         no tier-hint lozenge growth - that used to reflow whatever sits
         above it (the ProductSheet footer's inline instance in particular). */
      .dealer-m-cart-pill{
        position:fixed;
        left:16px;
        right:16px;
        bottom:calc(64px + env(safe-area-inset-bottom, 0px) + 12px);
        z-index:1490;
        height:48px;
        border:none;
        border-radius:14px;
        background:var(--color-ink,#1d1d1f);
        color:#fff;
        display:grid;
        /* Explicit rather than relying on the "normal" default resolving to
           stretch - without this, .dealer-m-cart-pill-row (sized to its own
           content, ~21px) can settle at the top of its 48px track instead
           of filling it, which is exactly "text stuck at the top". */
        align-items:stretch;
        padding:0 16px;
        cursor:pointer;
        box-shadow:0 10px 30px rgba(0,0,0,.22);
        opacity:0;
        transform:translateY(12px) scale(.96);
        pointer-events:none;
        transition:opacity 220ms var(--ease-out-strong, cubic-bezier(0.23,1,0.32,1)),
          transform 220ms var(--ease-out-strong, cubic-bezier(0.23,1,0.32,1));
      }
      .dealer-m-cart-pill.visible{
        opacity:1;
        transform:translateY(0) scale(1);
        pointer-events:auto;
      }
      .dealer-m-cart-pill.visible:active{ transform:translateY(0) scale(0.97); }
      /* Embedded in ProductSheet's own footer, in the exact spot the old
         "Add to order" button used to sit - same pill, normal document flow
         instead of position:fixed. It's revealed by its footer mounting in
         the first place, so it doesn't need its own slide-up entrance too -
         just a plain fade, and no vertical drift that would nudge the
         sheet's own layout while it settles. */
      .dealer-m-cart-pill-inline{
        position:static;
        width:100%;
        transform:none;
      }
      .dealer-m-cart-pill-inline.visible{ transform:none; }
      .dealer-m-cart-pill-inline.visible:active{ transform:scale(0.97); }
      /* Fixed, equal-width side columns (not flex+gap) so the middle text
         column sits at the row's true horizontal center regardless of the
         cart/chevron glyphs' own differing widths - flex centering only
         centers the icon+text+icon group as a block, which visibly skews
         the text a couple px off-center when its flanking icons differ in
         size. Vertical centering comes from align-items on this same row. */
      .dealer-m-cart-pill-row{
        display:grid;
        grid-template-columns:20px 1fr 20px;
        align-items:center;
        gap:9px;
        height:100%;
        min-height:0;
        overflow:hidden;
      }
      .dealer-m-cart-pill-side{
        display:grid;
        place-items:center;
      }
      .dealer-m-cart-pill-text{
        font-size:var(--t-callout);
        font-weight:600;
        font-variant-numeric:tabular-nums;
        text-align:center;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      /* V3 §5.4: rolling total - blur-crossfade in on every itemCount/
         subtotal change (CartPill.jsx remounts this node via a key prop).
         No per-digit odometer roll - over-animated for a value that can
         change many times per session. */
      .dealer-m-cart-pill-text-roll{
        animation:dealerCartPillTextRoll .15s var(--ease-out,ease) both;
      }
      @keyframes dealerCartPillTextRoll{
        from{ opacity:.3; filter:blur(2px); }
        to{ opacity:1; filter:blur(0); }
      }

      /* Extra bottom clearance so scrollable page content never sits behind
         the fixed bottom tab bar / cart pill. !important because this style
         tag renders inside .dashboard-content (a DealerDashboardPage child),
         earlier in document order than DashboardShell's own trailing <style>
         block, which would otherwise win the cascade tie on plain specificity. */
      @media (max-width:768px){
        .dashboard-main-shell{
          padding-bottom:calc(64px + env(safe-area-inset-bottom, 0px) + 24px) !important;
        }
      }

      /* ---- Generic mobile-screen helpers (shared by every screen) ---- */
      .dealer-m-refetch-hairline{
        position:relative;
        height:2px;
        margin:-4px 0 12px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(0,113,227,.14);
      }
      .dealer-m-refetch-hairline::after{
        content:"";
        position:absolute;
        top:0; bottom:0; left:-40%;
        width:40%;
        background:var(--color-azure,#0071e3);
        border-radius:999px;
        animation:dealerRefetchSlide 1.1s ease-in-out infinite;
      }
      @keyframes dealerRefetchSlide{
        0%{ left:-40%; }
        100%{ left:100%; }
      }
      .dealer-m-skel{
        border-radius:12px;
        background:linear-gradient(90deg, rgba(0,0,0,.045), rgba(0,0,0,.02), rgba(0,0,0,.045));
        background-size:200% 100%;
        animation:dealerSkelShimmer 1.4s ease-in-out infinite;
      }
      @keyframes dealerSkelShimmer{
        0%{ background-position:200% 0; }
        100%{ background-position:-200% 0; }
      }
      /* ---- SkeletonSwap ---- */
      /* V3 §5.5: skeleton and content share one grid cell (same
         stacked-opacity technique as .dealer-m-tabbar-icon-crossfade
         above) so the swap is a real overlap-crossfade, not a hard
         replace. Single-column implicit grid, so this reads as a plain
         block wrapper otherwise - safe to drop into any page's existing
         flow. */
      .dealer-m-skeleton-swap{ display:grid; }
      .dealer-m-skeleton-swap-skel,
      .dealer-m-skeleton-swap-content{ grid-area:1/1; min-width:0; }
      .dealer-m-skeleton-swap-skel{
        opacity:1;
        transition:opacity .15s ease;
      }
      .dealer-m-skeleton-swap-skel.leaving{ opacity:0; }
      .dealer-m-skeleton-swap-content{
        animation:dealerSkeletonSwapIn .2s var(--ease-out,ease) both;
      }
      @keyframes dealerSkeletonSwapIn{
        from{ opacity:0; transform:translateY(4px); }
        to{ opacity:1; transform:translateY(0); }
      }
      @media (prefers-reduced-motion: reduce){
        .dealer-m-skeleton-swap-skel{ transition:none; }
        .dealer-m-skeleton-swap-content{ animation:none; }
      }
      .dealer-m-error-card{
        padding:24px 20px;
        border-radius:20px;
        background:var(--color-snow,#fff);
        text-align:center;
      }
      .dealer-m-error-title{
        font-size:var(--t-callout);
        font-weight:600;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-error-retry{
        margin-top:10px;
        border:none;
        background:none;
        color:var(--color-azure,#0071e3);
        font-size:var(--t-subhead);
        font-weight:600;
        cursor:pointer;
        transition:transform 120ms ease-out;
      }
      .dealer-m-error-retry:active{ transform:scale(0.96); }
      .dealer-m-empty{
        padding:48px 20px;
        text-align:center;
      }
      .dealer-m-empty-icon{
        color:rgba(29,29,31,.28);
      }
      .dealer-m-empty-title{
        margin-top:12px;
        font-size:var(--t-body-lg);
        font-weight:600;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-empty-action{
        margin-top:10px;
        border:none;
        background:none;
        color:var(--color-azure,#0071e3);
        font-size:var(--t-callout);
        font-weight:600;
        cursor:pointer;
        transition:transform 120ms ease-out;
        display:inline-block;
      }
      .dealer-m-empty-action:active{ transform:scale(0.96); }
    `}</style>
  );
}
