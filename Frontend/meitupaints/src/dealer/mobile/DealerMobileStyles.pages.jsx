// Page-specific <style> block for every dealer/mobile/* screen -
// DealerHomePage, ProductSheet, DealerCatalogMobileView,
// DealerCartMobileView (incl. confirm sheet + placed screen),
// DealerInventoryMobileView + detail, DealerSalesMobileView
// (incl. sale detail + NewSaleMobileSheet), DealerMoreDrawer,
// DealerOrderDetailMobileView, DealerOrdersMobileView, and the shared
// reduced-motion overrides. Split from the original single
// DealerMobileStyles.jsx once it passed ~2000 lines (spec §6) -
// shared primitive CSS lives in DealerMobileStyles.core.jsx. Both are
// rendered together, once, from DealerDashboardPage.jsx.
export function DealerMobileStylesPages() {
  return (
    <style>{`
      /* ---- DealerHomePage ---- */
      .dealer-m-home{
        display:flex;
        flex-direction:column;
        gap:16px;
        padding-block:4px 0;
        padding-inline:var(--dealer-m-gutter);
      }
      /* SkeletonSwap wraps its children in their own grid box (for the
         crossfade overlap) rather than passing them straight through, so
         without this the individual home cards lose .dealer-m-home's own
         flex gap and render stacked flush against each other. */
      .dealer-m-home .dealer-m-skeleton-swap-content{
        display:flex;
        flex-direction:column;
        gap:16px;
      }
      .dealer-m-home-stagger{
        animation:dealerHomeCardIn 320ms var(--ease-out-strong, ease-out) both;
      }
      @keyframes dealerHomeCardIn{
        from{ opacity:0; transform:translateY(8px); }
        to{ opacity:1; transform:translateY(0); }
      }
      .dealer-m-home-card{
        width:100%;
        border:none;
        text-align:left;
        border-radius:20px;
        background:var(--color-snow,#fff);
        padding:20px;
        cursor:default;
        transition:transform 120ms ease-out;
      }
      button.dealer-m-home-card{ cursor:pointer; }
      button.dealer-m-home-card:active{ transform:scale(0.98); }
      .dealer-m-home-live-top{
        display:flex;
        align-items:center;
        justify-content:space-between;
      }
      .dealer-m-home-live-number{
        font-size:var(--t-footnote);
        font-weight:600;
        color:var(--color-graphite,#707070);
      }
      /* Live Activity card (spec §2.2) - the one dark surface in the app. */
      .dealer-m-home-live-card{
        display:block;
        background:var(--color-ink,#1d1d1f);
      }
      .dealer-m-home-live-card .dealer-m-home-live-number{ color:rgba(255,255,255,.6); }
      .dealer-m-home-live-card .dealer-m-status-rail{ margin-top:16px; }
      .dealer-m-home-live-card .dealer-m-status-rail-dot-done{ background:#fff; }
      .dealer-m-home-live-card .dealer-m-status-rail-dot-upcoming{
        background:transparent;
        border-color:rgba(255,255,255,.32);
      }
      .dealer-m-home-live-card .dealer-m-status-rail-line-done{ background:#fff; }
      .dealer-m-home-live-card .dealer-m-status-rail-line-pending{ background:rgba(255,255,255,.22); }
      .dealer-m-home-live-card .dealer-m-status-rail-dot-current{
        animation:dealerLiveRailPulse 2s ease-in-out infinite;
        box-shadow:none;
      }
      @keyframes dealerLiveRailPulse{
        0%,100%{ opacity:1; }
        50%{ opacity:.5; }
      }
      .dealer-m-status-chip-inverted{
        color:#fff;
        background:rgba(255,255,255,.18);
      }
      .dealer-m-home-live-stage{
        margin-top:10px;
        font-size:var(--t-callout);
        font-weight:600;
        color:#fff;
      }
      .dealer-m-home-live-timestamp{
        margin-top:4px;
        font-size:var(--t-caption);
        color:rgba(255,255,255,.6);
      }
      .dealer-m-home-live-more{
        margin-top:6px;
        font-size:var(--t-footnote);
        font-weight:600;
        color:#fff;
      }
      .dealer-m-home-card-label{
        font-size:var(--t-caption);
        font-weight:700;
        letter-spacing:.04em;
        text-transform:uppercase;
        color:var(--color-graphite,#707070);
      }
      .dealer-m-home-reorder-head{
        display:flex;
        align-items:baseline;
        justify-content:space-between;
        gap:12px;
      }
      .dealer-m-home-firstrun-title{
        margin-top:6px;
        font-size:var(--t-headline);
        font-weight:700;
        color:var(--color-ink,#1d1d1f);
      }
      /* 48px overlapping thumbnail stack, App Store "get" widget grammar
         (spec §5.3): each ring-bordered circle overlaps the previous by
         12px, z-index descends left-to-right so the front-most (first)
         item reads on top, +N end cap forced above the whole stack. */
      .dealer-m-home-thumbs{
        display:flex;
        margin-top:14px;
      }
      .dealer-m-home-thumb{
        position:relative;
        width:48px;
        height:48px;
        border-radius:999px;
        background:var(--color-fog,#f5f5f7);
        display:grid;
        place-items:center;
        overflow:hidden;
        flex-shrink:0;
        color:var(--color-graphite,#707070);
        box-shadow:0 0 0 2px var(--color-snow,#fff);
      }
      .dealer-m-home-thumb:not(:first-child){ margin-left:-12px; }
      .dealer-m-home-thumb img{ width:100%; height:100%; object-fit:cover; }
      .dealer-m-home-thumb-overflow{
        width:48px;
        height:48px;
        border-radius:999px;
        background:var(--color-ink,#1d1d1f);
        display:grid;
        place-items:center;
        font-size:var(--t-footnote);
        font-weight:700;
        color:#fff;
        flex-shrink:0;
        box-shadow:0 0 0 2px var(--color-snow,#fff);
        margin-left:-12px;
      }
      .dealer-m-home-card-total{
        font-size:var(--t-headline);
        font-weight:700;
        font-variant-numeric:tabular-nums;
        color:var(--color-ink,#1d1d1f);
        white-space:nowrap;
      }
      .dealer-m-home-quick-row{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:12px;
      }
      .dealer-m-home-quick-card{
        border:none;
        border-radius:16px;
        background:var(--color-snow,#fff);
        padding:18px 14px;
        display:flex;
        flex-direction:column;
        align-items:flex-start;
        gap:10px;
        cursor:pointer;
        transition:transform 120ms ease-out;
      }
      .dealer-m-home-quick-card:active{ transform:scale(0.97); }
      .dealer-m-home-quick-icon{
        width:44px;
        height:44px;
        border-radius:999px;
        background:var(--color-fog,#f5f5f7);
        display:grid;
        place-items:center;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-home-quick-label{
        font-size:var(--t-callout);
        font-weight:600;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-home-stats{ padding:16px 20px; }
      .dealer-m-home-stats-row{
        display:flex;
      }
      .dealer-m-home-stat{
        flex:1;
        text-align:center;
        padding:0 8px;
      }
      .dealer-m-home-stat + .dealer-m-home-stat{
        border-left:1px solid rgba(29,29,31,.08);
      }
      .dealer-m-home-stat-value{
        font-size:var(--t-headline);
        font-weight:700;
        font-variant-numeric:tabular-nums;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-home-stat-label{
        margin-top:2px;
        font-size:var(--t-caption);
        color:var(--color-graphite,#707070);
      }
      /* 7-bar spend sparkline (spec §2.3) - pure CSS from real data, no
         chart library; today's bar is the only azure one. */
      .dealer-m-home-sparkline{
        display:flex;
        align-items:flex-end;
        gap:5px;
        height:24px;
        margin-top:16px;
        padding:0 4px;
      }
      .dealer-m-home-sparkline-bar{
        flex:1;
        max-width:3px;
        border-radius:1.5px;
        background:var(--color-fog,#f5f5f7);
      }
      .dealer-m-home-sparkline-bar.today{ background:var(--color-azure,#0071e3); }
      .dealer-m-home-skeleton-line{
        border-radius:8px;
        background:linear-gradient(90deg, rgba(0,0,0,.045), rgba(0,0,0,.02), rgba(0,0,0,.045));
      }
      .dealer-m-home-skeleton-card{
        height:120px;
        margin-top:16px;
        border-radius:20px;
        background:linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04));
      }
      .dealer-m-home-error-card{
        margin-top:24px;
        padding:24px 20px;
        border-radius:20px;
        background:var(--color-snow,#fff);
        text-align:center;
      }
      .dealer-m-home-error-title{
        font-size:var(--t-callout);
        font-weight:600;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-home-error-retry{
        margin-top:10px;
        border:none;
        background:none;
        color:var(--color-azure,#0071e3);
        font-size:var(--t-subhead);
        font-weight:600;
        cursor:pointer;
        transition:transform 120ms ease-out;
      }
      .dealer-m-home-error-retry:active{ transform:scale(0.96); }

      /* ---- ProductSheet ---- */
      /* V3 §1: real drawer, not a mount/unmount switch (see MobileSheet.jsx).
         .closing plays the mirror-image exit keyframe on scrim-tap/close-
         button/programmatic closes; drag-driven dismissals skip this class
         entirely and animate via their own inline-style transition instead
         (useSheetDrag.js) so the two mechanisms never fight over transform/
         opacity on the same frame. touch-action:none on the scrim keeps a
         touch on the backdrop itself from producing any native scroll/bounce
         behind it - useBodyScrollLock already covers the page underneath. */
      .dealer-m-sheet-scrim{
        position:fixed;
        inset:0;
        z-index:1700;
        background:rgba(245,245,247,.4);
        backdrop-filter:blur(6px);
        -webkit-backdrop-filter:blur(6px);
        display:flex;
        align-items:flex-end;
        touch-action:none;
        animation:dealerSheetScrimIn .2s ease-out both;
      }
      .dealer-m-sheet-scrim.closing{
        animation:dealerSheetScrimOut .2s ease-out forwards;
      }
      @keyframes dealerSheetScrimIn{ from{ opacity:0; } to{ opacity:1; } }
      @keyframes dealerSheetScrimOut{ from{ opacity:1; } to{ opacity:0; } }
      .dealer-m-sheet{
        position:relative;
        width:100%;
        max-height:85vh;
        display:flex;
        flex-direction:column;
        background:var(--color-snow,#fff);
        border-radius:24px 24px 0 0;
        padding-bottom:env(safe-area-inset-bottom, 0px);
        animation:dealerSheetIn .4s var(--ease-sheet,cubic-bezier(0.32,0.72,0,1)) both;
      }
      .dealer-m-sheet.closing{
        animation:dealerSheetOut .25s ease-in forwards;
      }
      .dealer-m-sheet-full{
        height:92vh;
        max-height:92vh;
      }
      @keyframes dealerSheetIn{
        from{ transform:translateY(100%); }
        to{ transform:translateY(0); }
      }
      @keyframes dealerSheetOut{
        from{ transform:translateY(0); }
        to{ transform:translateY(100%); }
      }
      .dealer-m-sheet-handle{
        width:36px;
        height:5px;
        border-radius:999px;
        background:rgba(29,29,31,.14);
        margin:10px auto 0;
        flex-shrink:0;
        touch-action:none;
      }
      /* V3 §5.8: first-open coach mark - a one-shot hint dip, delayed
         400ms so it plays after the sheet has visibly settled open, not
         fighting the entrance animation. ProductSheet.jsx owns the
         once-ever gating (localStorage); this is purely the visual. */
      .dealer-m-sheet-handle.coachmark{
        animation:dealerHandleCoachMark 600ms var(--ease-in-out-strong,ease) 400ms both;
      }
      @keyframes dealerHandleCoachMark{
        0%, 100%{ transform:translateY(0); }
        50%{ transform:translateY(6px); }
      }
      .dealer-m-sheet-close{
        position:absolute;
        top:14px;
        right:14px;
        width:30px;
        height:30px;
        border-radius:999px;
        border:none;
        background:var(--color-fog,#f5f5f7);
        color:var(--color-graphite,#707070);
        display:grid;
        place-items:center;
        cursor:pointer;
        z-index:1;
        transition:transform 120ms ease-out;
      }
      .dealer-m-sheet-close:active{ transform:scale(0.92); }
      .dealer-m-sheet-scroll{
        flex:1 1 auto;
        min-height:0;
        overflow-y:auto;
        overscroll-behavior:contain;
        padding:8px 20px 20px;
      }
      .dealer-m-sheet-stage{
        position:relative;
        height:180px;
        border-radius:20px;
        background:radial-gradient(circle at 50% 40%, var(--color-fog,#f5f5f7), rgba(245,245,247,.4));
        display:grid;
        place-items:center;
        color:var(--color-graphite,#707070);
        margin-top:6px;
        /* The image swipe-between-photos gesture applies an unclamped
           translateX() drag offset (ProductSheet.jsx's dragX) directly to
           the <img> - without clipping, a long drag slides the photo
           straight out past this card's rounded corners instead of
           staying contained within it. */
        overflow:hidden;
      }
      /* Two nested boxes, not max-width/max-height:70% directly on the img
         (that silently failed to resolve - see the catalog card comment
         below for the general mechanism - AND absolutely positioned
         REPLACED elements like <img> with auto width/height don't stretch
         between opposing insets the way a plain <div> does; they fall back
         to sizing from their own intrinsic ratio instead, so inset:15%
         directly on the <img> rendered it far larger than the frame). The
         frame is a plain (non-replaced) div, which DOES reliably stretch
         to fill inset:15% (a definite, unambiguous 70%x70% box); the img
         inside it then has that box as its actual containing block, so
         width/height:100% + object-fit:contain correctly contain the photo
         within it - exactly the same two-layer shape as the catalog card. */
      .dealer-m-sheet-stage-frame{
        position:absolute;
        inset:15%;
      }
      .dealer-m-sheet-stage-frame img{
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        object-fit:contain;
        cursor:pointer;
      }
      .dealer-m-sheet-dots{
        position:absolute;
        bottom:10px;
        left:0; right:0;
        display:flex;
        justify-content:center;
        gap:5px;
      }
      .dealer-m-sheet-dot{
        width:24px; height:24px;
        padding:0;
        border:none;
        background:transparent;
        display:grid;
        place-items:center;
        cursor:pointer;
        transition:transform 120ms ease-out;
      }
      .dealer-m-sheet-dot:active{ transform:scale(0.85); }
      .dealer-m-sheet-dot::before{
        content:"";
        width:4px; height:4px;
        border-radius:999px;
        background:rgba(29,29,31,.2);
        transition:background 150ms ease, transform 150ms var(--ease-out-strong,ease);
      }
      .dealer-m-sheet-dot.active::before{
        background:var(--color-ink,#1d1d1f);
        transform:scale(1.4);
      }
      .dealer-m-sheet-identity{ margin-top:18px; }
      .dealer-m-sheet-name{
        font-size:var(--t-title3);
        font-weight:700;
        letter-spacing:-0.02em;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-sheet-category{
        margin-top:2px;
        font-size:var(--t-subhead);
        color:var(--color-graphite,#707070);
      }
      .dealer-m-sheet-desc{
        margin-top:8px;
        font-size:var(--t-callout);
        color:var(--color-graphite,#707070);
        line-height:1.4;
        display:-webkit-box;
        -webkit-line-clamp:1;
        -webkit-box-orient:vertical;
        overflow:hidden;
      }
      .dealer-m-sheet-packs{
        margin-top:18px;
        display:grid;
        gap:8px;
      }
      /* V2 §1.3: each pack row is a selectable card - fixed height always
         (label + price + a selection indicator only). It never grows to
         show its own quantity controls; those live in the shared detail
         zone below the list instead (.dealer-m-sheet-detail), so tapping
         between sizes never pushes any other row, or anything below the
         list, up or down. */
      .dealer-m-sheet-pack-row{
        border-radius:14px;
        border:1.5px solid var(--color-silver-mist,#e8e8ed);
        background:var(--color-snow,#fff);
        overflow:hidden;
        transition:border-color 200ms ease, background 200ms ease;
      }
      .dealer-m-sheet-pack-row.selected{
        border-color:var(--color-azure,#0071e3);
        background:rgba(0,113,227,.04);
      }
      .dealer-m-sheet-pack-row.priceless{
        border-color:rgba(193,18,31,.3);
        background:rgba(193,18,31,.04);
      }
      .dealer-m-sheet-pack-row.priceless .dealer-m-sheet-pack-price-line{
        color:var(--color-meitu-red,#c1121f);
      }
      .dealer-m-sheet-pack-row-head{
        width:100%;
        display:flex;
        align-items:center;
        justify-content:space-between;
        height:52px;
        padding:0 16px;
        border:none;
        background:transparent;
        cursor:pointer;
        text-align:left;
        transition:transform 120ms ease-out;
      }
      .dealer-m-sheet-pack-row-head:active{ transform:scale(0.98); }
      .dealer-m-sheet-pack-row-head:disabled{ cursor:not-allowed; }
      .dealer-m-sheet-pack-row-head:disabled:active{ transform:none; }
      .dealer-m-sheet-pack-info{
        display:flex;
        flex-direction:column;
        gap:2px;
        min-width:0;
      }
      .dealer-m-sheet-pack-label{
        font-size:var(--t-body-lg);
        font-weight:600;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-sheet-pack-price-line{
        font-size:var(--t-footnote);
        font-weight:500;
        font-variant-numeric:tabular-nums;
        color:var(--color-graphite,#707070);
      }
      .dealer-m-sheet-pack-price-base{
        margin-right:6px;
        text-decoration:line-through;
      }
      .dealer-m-sheet-pack-check{
        width:20px;
        height:20px;
        flex-shrink:0;
        border-radius:999px;
        background:var(--color-azure,#0071e3);
        color:#fff;
        display:grid;
        place-items:center;
        animation:dealerCheckDraw 200ms var(--ease-out-strong,ease) both;
      }
      @keyframes dealerCheckDraw{
        from{ transform:scale(.6); opacity:0; }
        to{ transform:scale(1); opacity:1; }
      }
      .dealer-m-sheet-pack-chip{
        flex-shrink:0;
        height:22px;
        padding:0 8px;
        border-radius:999px;
        background:var(--color-fog,#f5f5f7);
        color:var(--color-ink,#1d1d1f);
        font-size:var(--t-caption);
        font-weight:600;
        display:inline-flex;
        align-items:center;
      }
      .dealer-m-sheet-pack-qty-col{
        display:flex;
        flex-direction:column;
        gap:6px;
      }
      .dealer-m-sheet-pack-qty-label{
        font-size:var(--t-footnote);
        color:var(--color-graphite,#707070);
      }
      .dealer-m-sheet-pack-math-col{ text-align:right; }
      .dealer-m-sheet-pack-math-line{
        font-size:var(--t-footnote);
        font-variant-numeric:tabular-nums;
        color:var(--color-graphite,#707070);
      }
      .dealer-m-sheet-pack-math-total{
        margin-top:2px;
        font-size:var(--t-body-lg);
        font-weight:700;
        font-variant-numeric:tabular-nums;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-sheet-family-hint{
        text-align:center;
        font-size:var(--t-caption);
        color:var(--color-graphite,#707070);
      }
      /* Fixed height always (sized for its own permanent content - a
         quantity stepper row + the tier ladder - which never structurally
         changes shape, see previewSku in ProductSheet.jsx). Reveal/hide is
         clip-path + opacity only, never a height/grid-rows change, so nothing
         else on the page ever needs to move for this block to show or hide.
         Reveal wipes upward from the bottom edge (top-inset 100%->0%); hide
         reverses the same property, so the content visibly folds away
         top-to-bottom - both directions are one CSS transition on one
         property, fully interruptible if the dealer taps again mid-motion. */
      .dealer-m-sheet-detail{
        margin-top:18px;
        padding-top:16px;
        border-top:1px solid rgba(29,29,31,.06);
        clip-path:inset(100% 0 0 0);
        opacity:0;
        pointer-events:none;
        transition:clip-path 280ms var(--ease-sheet,ease), opacity 220ms var(--ease-sheet,ease);
      }
      .dealer-m-sheet-detail.expanded{
        clip-path:inset(0 0 0 0);
        opacity:1;
        pointer-events:auto;
      }
      .dealer-m-sheet-detail-row{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:12px;
      }
      .dealer-m-sheet-footer{
        flex-shrink:0;
        padding:12px 20px calc(12px + env(safe-area-inset-bottom, 0px));
        border-top:1px solid rgba(29,29,31,.06);
      }

      /* ---- DealerCatalogMobileView ---- */
      .dealer-m-catalog{ padding-block:4px 0; padding-inline:var(--dealer-m-gutter); }
      .dealer-m-catalog-search{
        height:44px;
        border-radius:12px;
        background:var(--color-fog,#f5f5f7);
        display:flex;
        align-items:center;
        gap:8px;
        padding:0 14px;
        color:var(--color-graphite,#707070);
      }
      .dealer-m-catalog-search input{
        flex:1;
        border:none;
        background:transparent;
        outline:none;
        /* V3 §3 exception - iOS zoom guard, must stay >=16px. */
        font-size:16px;
        color:var(--color-ink,#1d1d1f);
      }
      /* V3 §2: icon-activated search (Products/Browse tab only - Inventory
         keeps the plain pinned .dealer-m-catalog-search bar above,
         untouched). Idle button sits in LargeTitleHeader's new trailing
         slot; the active overlay reuses the sticky slot, which is how it
         gets pinned-while-scrolling during an active search for free. */
      .dealer-m-catalog-search-btn{
        width:36px;
        height:36px;
        border-radius:999px;
        border:none;
        background:var(--color-fog,#f5f5f7);
        color:var(--color-graphite,#707070);
        display:grid;
        place-items:center;
        cursor:pointer;
        transition:transform 120ms ease-out;
      }
      .dealer-m-catalog-search-btn:active{ transform:scale(0.92); }
      .dealer-m-catalog-search-overlay{
        display:flex;
        align-items:center;
        gap:10px;
      }
      .dealer-m-catalog-search-overlay-field{
        flex:1 1 auto;
        min-width:0;
        height:44px;
        border-radius:12px;
        background:var(--color-fog,#f5f5f7);
        display:flex;
        align-items:center;
        gap:8px;
        padding:0 14px;
        color:var(--color-graphite,#707070);
        transform-origin:top right;
        animation:dealerSearchOverlayIn 250ms var(--ease-out-strong,ease) both;
      }
      /* iOS Safari zoom guard - must stay >=16px regardless of the §3
         type-scale sweep (same reasoning as .dealer-m-catalog-search input
         above, which this is visually replacing while active). */
      .dealer-m-catalog-search-overlay-field input{
        flex:1 1 auto;
        min-width:0;
        border:none;
        background:transparent;
        outline:none;
        font-size:16px;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-catalog-search-cancel{
        flex-shrink:0;
        border:none;
        background:none;
        color:var(--color-azure,#0071e3);
        font-size:var(--t-callout);
        font-weight:600;
        cursor:pointer;
        padding:8px 2px;
        animation:dealerSearchCancelIn 220ms var(--ease-out-strong,ease) 30ms both;
      }
      @keyframes dealerSearchOverlayIn{
        from{ opacity:0; transform:scale(0.9); }
        to{ opacity:1; transform:scale(1); }
      }
      @keyframes dealerSearchCancelIn{
        from{ opacity:0; transform:translateX(8px); }
        to{ opacity:1; transform:translateX(0); }
      }
      /* Reverse of the two keyframes above, played while the overlay stays
         mounted for one closing beat (DealerCatalogMobileView.jsx's
         searchClosing) instead of just vanishing on Cancel/clear+blur -
         exit is faster than enter per the constitution. */
      .dealer-m-catalog-search-overlay.closing .dealer-m-catalog-search-overlay-field{
        animation:dealerSearchOverlayOut 200ms ease-out both;
      }
      .dealer-m-catalog-search-overlay.closing .dealer-m-catalog-search-cancel{
        animation:dealerSearchCancelOut 180ms ease-out both;
      }
      @keyframes dealerSearchOverlayOut{
        from{ opacity:1; transform:scale(1); }
        to{ opacity:0; transform:scale(0.9); }
      }
      @keyframes dealerSearchCancelOut{
        from{ opacity:1; transform:translateX(0); }
        to{ opacity:0; transform:translateX(8px); }
      }
      .dealer-m-catalog-suggestions{
        margin-top:14px;
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        justify-content:center;
        gap:8px;
      }
      .dealer-m-catalog-suggestions-label{
        font-size:var(--t-footnote);
        color:var(--color-graphite,#707070);
      }
      .dealer-m-catalog-suggestion-pill{
        height:30px;
        padding:0 14px;
        border-radius:999px;
        border:none;
        background:var(--color-fog,#f5f5f7);
        color:var(--color-ink,#1d1d1f);
        font-size:var(--t-footnote);
        font-weight:600;
        cursor:pointer;
        transition:transform 120ms ease-out;
      }
      .dealer-m-catalog-suggestion-pill:active{ transform:scale(0.94); }
      .dealer-m-catalog-chips{
        margin-top:14px;
        display:flex;
        gap:8px;
        overflow-x:auto;
        padding-bottom:2px;
        /* Full-bleed exception (§1.1): first chip stays on the text grid,
           the scroll region itself reaches the screen edge - App Store
           horizontal-shelf convention. */
        margin-inline:calc(var(--dealer-m-gutter) * -1);
        padding-inline:var(--dealer-m-gutter);
      }
      .dealer-m-catalog-chip{
        flex-shrink:0;
        height:34px;
        padding:0 16px;
        border-radius:999px;
        border:none;
        background:var(--color-fog,#f5f5f7);
        color:var(--color-ink,#1d1d1f);
        font-size:var(--t-subhead);
        font-weight:600;
        cursor:pointer;
        transition:transform 120ms ease-out;
      }
      .dealer-m-catalog-chip:active{ transform:scale(0.96); }
      .dealer-m-catalog-chip.active{
        background:var(--color-ink,#1d1d1f);
        color:#fff;
      }
      .dealer-m-catalog-list{
        margin-top:18px;
        display:flex;
        flex-direction:column;
        gap:12px;
      }
      /* "All Products" groups by category into an App Store "Recently
         Updated"-style horizontal grid - a specific category chip already
         narrows to one category, so it stays the plain, non-scrolling
         .dealer-m-catalog-list below with no group wrapper at all. */
      .dealer-m-catalog-groups{ margin-top:18px; }
      .dealer-m-catalog-group{ margin-top:26px; }
      .dealer-m-catalog-group:first-of-type{ margin-top:0; }
      .dealer-m-catalog-group-header{
        display:flex;
        align-items:center;
        gap:4px;
        border:none;
        background:none;
        padding:0;
        cursor:pointer;
        color:inherit;
        /* Full 44px tap target height without pushing the label down -
           the button's own box grows, the label/chevron inside stay
           visually where a plain heading would sit. */
        min-height:28px;
      }
      .dealer-m-catalog-group-header:active{ opacity:.5; }
      .dealer-m-catalog-group-label{
        font-size:var(--t-footnote);
        font-weight:700;
        letter-spacing:.02em;
        text-transform:uppercase;
        color:var(--color-graphite,#707070);
      }
      .dealer-m-catalog-group-chevron{ color:var(--color-graphite,#707070); opacity:.6; }
      /* Same full-bleed gutter-breakout as .dealer-m-catalog-chips - the
         scroll region itself reaches the screen edge, the first column
         starts aligned with the text grid. Each column is narrower than
         the full content width so the next column's card edge peeks in -
         the scroll affordance Apple's own "Recently Updated" shelf uses,
         replicated here rather than a decorative fade/gradient. A fixed
         pixel reduction (not a percentage) keeps the peek a small,
         consistent sliver regardless of screen width, rather than growing
         on wider phones. Every category renders through this same
         structure regardless of how many products it has - a category
         that only fills one column still gets a card this same size, not
         stretched to fill the row. */
      .dealer-m-catalog-scroll-row{
        margin-top:10px;
        display:flex;
        gap:12px;
        overflow-x:auto;
        padding-bottom:2px;
        scroll-snap-type:x mandatory;
        -webkit-overflow-scrolling:touch;
        margin-inline:calc(var(--dealer-m-gutter) * -1);
        padding-inline:var(--dealer-m-gutter);
      }
      .dealer-m-catalog-scroll-column{
        /* At rest the visible peek = the row's own leading padding (the
           gutter, 16px - the viewport shows content in place of that
           padding rather than blank space, since nothing's been scrolled
           past yet) + this reduction - the 12px row gap. With a 12px
           reduction that's 16 + 12 - 12 = 16px of the next column visible
           at rest - a small, deliberate sliver, not a near-full second
           card (confirmed empirically, not just computed on paper). */
        flex:0 0 calc(100% - 12px);
        width:calc(100% - 12px);
        display:flex;
        flex-direction:column;
        gap:12px;
        /* center, not start - with start, a swiped-to column snaps flush
           against the row's left edge, so only the NEXT column ever peeks
           in (on the right) and the one just scrolled past never does (on
           the left). Centering the snapped column leaves an equal sliver
           of both neighbors visible on both sides after every swipe. */
        scroll-snap-align:center;
      }
      .dealer-m-catalog-card{
        width:100%;
        display:flex;
        align-items:center;
        gap:14px;
        padding:16px;
        border:1.5px solid transparent;
        border-radius:20px;
        background:var(--color-snow,#fff);
        cursor:pointer;
        text-align:left;
        transition:transform 120ms ease-out, border-color 150ms ease-out, background 150ms ease-out;
      }
      .dealer-m-catalog-card:active{ transform:scale(0.98); }
      /* Already-in-the-draft highlight (transparent->azure border swap, no
         layout shift since the border width never changes). */
      .dealer-m-catalog-card.selected{
        border-color:var(--color-azure,#0071e3);
        background:rgba(0,113,227,.04);
      }
      /* No confirmed price yet (e.g. Wall Putty/Colorants pending the new
         fiscal-year rate list) - flagged so a dealer never mistakes it for
         a normal, orderable product. Add-to-cart itself is blocked inside
         ProductSheet, not here - this card still opens to show details. */
      .dealer-m-catalog-card.priceless{
        border-color:rgba(193,18,31,.3);
        background:rgba(193,18,31,.04);
      }
      .dealer-m-catalog-card-image{
        position:relative;
        width:72px;
        height:72px;
        flex-shrink:0;
        border-radius:14px;
        background:var(--color-fog,#f5f5f7);
        display:grid;
        place-items:center;
        overflow:hidden;
        color:var(--color-graphite,#707070);
      }
      /* object-fit:contain (not cover) - the whole product photo stays
         visible, letterboxed against the card's own fog background rather
         than cropped to fill the fixed 72x72 box. position:absolute/inset:0
         (not width/height:100%) deliberately - a percentage height on a
         grid item only resolves against a DEFINITE containing-block height,
         and place-items:center (above) leaves this grid item auto-sized to
         its own content instead of stretched to the 72px cell, so
         height:100% silently failed to resolve and fell back to scaling
         from the image's natural aspect ratio alone - portrait product
         photos (taller than wide) then overflowed the box vertically and
         got clipped by overflow:hidden. An absolutely positioned element's
         containing block is always the definite box of its positioned
         ancestor, regardless of the parent's grid alignment mode, so
         inset:0 reliably gives object-fit an actual 72x72 box to contain
         within. */
      .dealer-m-catalog-card-image img{ position:absolute; inset:0; width:100%; height:100%; object-fit:contain; }
      .dealer-m-catalog-card-body{
        flex:1;
        min-width:0;
        display:flex;
        flex-direction:column;
        gap:2px;
      }
      .dealer-m-catalog-card-name{
        font-size:var(--t-body-lg);
        font-weight:600;
        color:var(--color-ink,#1d1d1f);
        overflow:hidden;
        text-overflow:ellipsis;
        display:-webkit-box;
        -webkit-line-clamp:2;
        -webkit-box-orient:vertical;
      }
      .dealer-m-catalog-card-category{
        font-size:var(--t-footnote);
        color:var(--color-graphite,#707070);
      }
      .dealer-m-catalog-card-price{
        margin-top:4px;
        font-size:var(--t-subhead);
        font-weight:600;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-catalog-card-price.priceless{
        color:var(--color-meitu-red,#c1121f);
      }
      .dealer-m-catalog-card-add{
        flex-shrink:0;
        width:36px;
        height:36px;
        border-radius:999px;
        background:var(--color-fog,#f5f5f7);
        color:var(--color-ink,#1d1d1f);
        display:grid;
        place-items:center;
        cursor:pointer;
        transition:transform 120ms ease-out;
      }
      .dealer-m-catalog-card-add:active{ transform:scale(0.9); }
      .dealer-m-catalog-card-chip{
        flex-shrink:0;
        height:28px;
        padding:0 10px;
        border-radius:999px;
        background:var(--color-azure,#0071e3);
        color:#fff;
        font-size:var(--t-footnote);
        font-weight:700;
        font-variant-numeric:tabular-nums;
        display:grid;
        place-items:center;
        cursor:pointer;
        transition:transform 120ms ease-out;
      }
      .dealer-m-catalog-card-chip:active{ transform:scale(0.9); }

      /* ---- DealerCartMobileView ---- */
      .dealer-m-cart{ padding-block:4px 0; padding-inline:var(--dealer-m-gutter); }
      .dealer-m-cart-title{
        font-size:var(--t-hero);
        font-weight:700;
        letter-spacing:-0.02em;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-cart-subtitle{
        margin-top:4px;
        font-size:var(--t-subhead);
        color:var(--color-graphite,#707070);
      }
      .dealer-m-cart-list{
        margin-top:18px;
        display:flex;
        flex-direction:column;
        gap:12px;
      }
      /* V3 §4.4: family-level removal collapse - wraps the WHOLE card
         (never restructures .dealer-m-cart-card itself, which stays
         exactly as it was). Same grid-template-rows 1fr->0fr + fade
         technique used throughout this codebase for non-height-animated
         collapse (ProductSheet's pack-expand/detail zone, MobileSheet's
         own lifecycle). */
      .dealer-m-cart-card-wrap{
        display:grid;
        grid-template-rows:1fr;
        opacity:1;
        transition:grid-template-rows 250ms var(--ease-in-out-strong,ease), opacity 250ms var(--ease-in-out-strong,ease);
      }
      .dealer-m-cart-card-wrap.removing{
        grid-template-rows:0fr;
        opacity:0;
      }
      .dealer-m-cart-card-wrap-inner{
        overflow:hidden;
        min-height:0;
      }
      .dealer-m-cart-card{
        border-radius:20px;
        background:var(--color-snow,#fff);
        padding:16px;
      }
      .dealer-m-cart-card-head{
        display:flex;
        align-items:center;
        gap:10px;
      }
      .dealer-m-cart-card-thumb{
        width:36px;
        height:36px;
        border-radius:10px;
        background:var(--color-fog,#f5f5f7);
        display:grid;
        place-items:center;
        overflow:hidden;
        flex-shrink:0;
        color:var(--color-graphite,#707070);
      }
      .dealer-m-cart-card-thumb img{ width:100%; height:100%; object-fit:cover; }
      .dealer-m-cart-card-name{
        flex:1;
        min-width:0;
        font-size:var(--t-body);
        font-weight:600;
        color:var(--color-ink,#1d1d1f);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      /* Set/bundle products (e.g. the Granite Epoxy Floor Paint kit) list
         their contents here - no price per component, just what's inside. */
      .dealer-m-cart-card-components{
        margin-top:6px;
        padding-left:46px;
        font-size:var(--t-footnote);
        color:var(--color-graphite,#707070);
        line-height:1.4;
      }
      .dealer-m-cart-card-subtotal{
        font-size:var(--t-body);
        font-weight:700;
        font-variant-numeric:tabular-nums;
        color:var(--color-ink,#1d1d1f);
      }
      /* V3 §4.3: quiet family-level removal, trailing edge of the header
         row. Generous vertical padding for a >=44px tap target despite the
         small visual footprint - the row naturally grows a little to fit
         it, which reads fine on a card header. */
      .dealer-m-cart-card-remove{
        flex-shrink:0;
        border:none;
        background:none;
        color:var(--color-graphite,#707070);
        font-size:var(--t-footnote);
        font-weight:600;
        cursor:pointer;
        padding:12px 2px 12px 10px;
      }
      .dealer-m-cart-card-remove:active{ opacity:0.5; }
      /* V3 §4.4: line-level removal collapse - wraps the swipe track, never
         .dealer-m-cart-line itself (shared verbatim with the read-only
         DealerOrderDetailMobileView.jsx - order-detail never renders this
         wrapper, so it's untouched by construction). */
      .dealer-m-cart-line-wrap{
        display:grid;
        grid-template-rows:1fr;
        opacity:1;
        transition:grid-template-rows 250ms var(--ease-in-out-strong,ease), opacity 250ms var(--ease-in-out-strong,ease);
      }
      .dealer-m-cart-line-wrap.removing{
        grid-template-rows:0fr;
        opacity:0;
      }
      .dealer-m-cart-line-wrap-inner{
        overflow:hidden;
        min-height:0;
      }
      /* Swipe-left-to-remove (V3 §4.1/§4.3): the red action sits absolutely
         behind, pinned to the trailing edge; .dealer-m-cart-line (unchanged
         base rule) is the translating foreground layer, dragged via
         useSwipeAction's ref/handlers. It needs an explicit opaque
         background here (scoped to this wrapper only, never the shared
         base rule) or the red action would bleed through even at rest,
         since .dealer-m-cart-line has no background of its own. */
      .dealer-m-cart-line-swipe-track{
        position:relative;
        overflow:hidden;
      }
      .dealer-m-cart-line-swipe-track > .dealer-m-cart-line{
        position:relative;
        background:var(--color-snow,#fff);
      }
      .dealer-m-cart-line-remove-action{
        position:absolute;
        /* top:12px, not 0 - .dealer-m-cart-line's own margin-top:12px sits
           OUTSIDE its border-box, so the opaque background scoped to it
           above doesn't cover that strip - starting the action there too
           (instead of inset:0) keeps it from peeking out above the line
           even at rest, without touching the shared base rule's spacing. */
        top:12px;
        right:0;
        bottom:0;
        left:auto;
        width:72px;
        border:none;
        background:var(--color-meitu-red,#c1121f);
        color:#fff;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:2px;
        font-size:var(--t-caption);
        font-weight:600;
        cursor:pointer;
      }
      .dealer-m-cart-line{
        margin-top:12px;
        padding-top:12px;
        border-top:1px solid rgba(29,29,31,.06);
        display:flex;
        align-items:center;
        gap:10px;
      }
      .dealer-m-cart-line-info{ flex:1; min-width:0; }
      .dealer-m-cart-line-label{
        font-size:var(--t-callout);
        font-weight:500;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-cart-line-rate{
        margin-top:2px;
        font-size:var(--t-footnote);
        color:var(--color-graphite,#707070);
      }
      .dealer-m-cart-line-total{
        font-size:var(--t-callout);
        font-weight:600;
        font-variant-numeric:tabular-nums;
        color:var(--color-ink,#1d1d1f);
        flex-shrink:0;
      }
      .dealer-m-cart-savings{
        margin-top:10px;
        font-size:var(--t-footnote);
        font-weight:600;
        color:#1a7f37;
      }
      .dealer-m-cart-summary{
        margin-top:16px;
        padding:16px 18px;
        border-radius:20px;
        background:var(--color-snow,#fff);
        display:grid;
        gap:8px;
      }
      .dealer-m-cart-summary-row{
        display:flex;
        justify-content:space-between;
        font-size:var(--t-subhead);
        color:var(--color-graphite,#707070);
        font-variant-numeric:tabular-nums;
      }
      .dealer-m-cart-summary-total{
        margin-top:6px;
        padding-top:10px;
        border-top:1px solid rgba(29,29,31,.08);
        /* Commitment-moment total (V3 §3 exception) - cart grand total. */
        font-size:20px;
        font-weight:700;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-cart-footer{
        margin-top:20px;
        padding-bottom:24px;
      }

      /* ---- Confirm sheet (extends the ProductSheet .dealer-m-sheet base) ---- */
      .dealer-m-confirm-title{
        margin-top:8px;
        font-size:var(--t-headline);
        font-weight:700;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-confirm-summary{
        margin-top:14px;
        padding:14px 16px;
        border-radius:14px;
        background:var(--color-fog,#f5f5f7);
        display:grid;
        gap:8px;
      }
      .dealer-m-confirm-row{
        display:flex;
        justify-content:space-between;
        font-size:var(--t-subhead);
        color:var(--color-graphite,#707070);
      }
      .dealer-m-confirm-row-total{
        /* Commitment-moment total (V3 §3 exception) - confirm-sheet total. */
        font-size:16px;
        font-weight:700;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-confirm-field-label{
        margin-top:18px;
        font-size:var(--t-caption);
        font-weight:700;
        letter-spacing:.04em;
        text-transform:uppercase;
        color:var(--color-graphite,#707070);
      }
      .dealer-m-confirm-payment-chips{
        margin-top:8px;
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      }
      .dealer-m-confirm-payment-chip{
        height:36px;
        padding:0 14px;
        border-radius:999px;
        border:1.5px solid var(--color-silver-mist,#e8e8ed);
        background:var(--color-snow,#fff);
        color:var(--color-ink,#1d1d1f);
        font-size:var(--t-subhead);
        font-weight:600;
        cursor:pointer;
        transition:transform 120ms ease-out;
      }
      .dealer-m-confirm-payment-chip:active{ transform:scale(0.96); }
      .dealer-m-confirm-payment-chip.active{
        border-color:var(--color-azure,#0071e3);
        background:rgba(0,113,227,.06);
        color:var(--color-azure,#0071e3);
      }
      .dealer-m-confirm-note-input{
        margin-top:8px;
        width:100%;
        height:44px;
        border-radius:12px;
        border:1.5px solid var(--color-silver-mist,#e8e8ed);
        padding:0 14px;
        /* V3 §3 exception - iOS zoom guard, bumped up from 15px to 16px. */
        font-size:16px;
        color:var(--color-ink,#1d1d1f);
        outline:none;
      }
      .dealer-m-confirm-error{
        margin-top:14px;
        padding:10px 12px;
        border-radius:10px;
        background:rgba(180,35,24,.08);
        color:#b42318;
        font-size:var(--t-footnote);
        font-weight:600;
      }

      /* ---- Placed / success screen ---- */
      .dealer-m-placed{
        min-height:60vh;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        padding:20px 32px;
        text-align:center;
      }
      .dealer-m-placed-check{
        width:64px;
        height:64px;
        border-radius:999px;
        background:rgba(26,127,55,.12);
        color:#1a7f37;
        display:grid;
        place-items:center;
        animation:dealerPlacedCheckIn .4s cubic-bezier(0.34,1.4,0.64,1) both;
      }
      @keyframes dealerPlacedCheckIn{
        from{ opacity:0; transform:scale(.9); }
        to{ opacity:1; transform:scale(1); }
      }
      /* Draw-in checkmark (spec §2.6 step ①) - pathLength="1" on the SVG
         path lets stroke-dasharray/-dashoffset use a normalized 0-1 range
         regardless of the path's real geometry. */
      .dealer-m-placed-check-path{
        stroke-dasharray:1;
        stroke-dashoffset:1;
        animation:dealerPlacedCheckDraw 400ms var(--ease-out-strong, ease-out) both;
      }
      @keyframes dealerPlacedCheckDraw{
        to{ stroke-dashoffset:0; }
      }
      /* Staged reveal (spec §2.6): headline/order-number/buttons each enter
         250ms apart via the same translateY(8px)+fade used for Home/Orders
         card entrances - reusing dealerHomeCardIn rather than a near-
         duplicate keyframe. */
      .dealer-m-placed-stage-2{ animation:dealerHomeCardIn 320ms var(--ease-out-strong, ease-out) 250ms both; }
      .dealer-m-placed-stage-3{ animation:dealerHomeCardIn 320ms var(--ease-out-strong, ease-out) 500ms both; }
      .dealer-m-placed-stage-4{ animation:dealerHomeCardIn 320ms var(--ease-out-strong, ease-out) 750ms both; }
      .dealer-m-placed-title{
        margin-top:20px;
        font-size:var(--t-title1);
        font-weight:700;
        letter-spacing:-0.02em;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-placed-number{
        margin-top:6px;
        font-size:var(--t-callout);
        color:var(--color-graphite,#707070);
      }
      .dealer-m-placed-actions{
        margin-top:28px;
        width:100%;
        display:grid;
        gap:12px;
      }
      .dealer-m-placed-secondary{
        border:none;
        background:none;
        color:var(--color-graphite,#707070);
        font-size:var(--t-callout);
        font-weight:600;
        cursor:pointer;
        padding:8px;
        transition:transform 120ms ease-out;
      }
      .dealer-m-placed-secondary:active{ transform:scale(0.96); }

      /* ---- Load more (shared ghost button, spec §4.1) ---- */
      .dealer-m-load-more{
        width:100%;
        margin-top:14px;
        height:44px;
        border-radius:12px;
        border:1.5px solid rgba(29,29,31,.12);
        background:transparent;
        color:var(--color-ink,#1d1d1f);
        font-size:var(--t-subhead);
        font-weight:600;
        cursor:pointer;
        transition:transform 120ms ease-out;
      }
      .dealer-m-load-more:active{ transform:scale(0.98); }

      /* ---- DealerInventoryMobileView ---- */
      .dealer-m-inventory{ padding-block:4px 24px; padding-inline:var(--dealer-m-gutter); }
      .dealer-m-inventory .dealer-m-segmented{ margin-top:14px; }
      .dealer-m-inventory .dealer-m-catalog-search{ margin-top:14px; }
      .dealer-m-inv-list{
        margin-top:16px;
        display:flex;
        flex-direction:column;
        gap:12px;
      }
      .dealer-m-inv-card{
        width:100%;
        display:flex;
        align-items:center;
        gap:12px;
        padding:12px 14px;
        border:none;
        border-radius:16px;
        background:var(--color-snow,#fff);
        cursor:pointer;
        text-align:left;
        transition:transform 120ms ease-out;
      }
      .dealer-m-inv-card:active{ transform:scale(0.98); }
      .dealer-m-inv-card-thumb{
        width:56px;
        height:56px;
        border-radius:12px;
        background:var(--color-fog,#f5f5f7);
        display:grid;
        place-items:center;
        overflow:hidden;
        flex-shrink:0;
        color:var(--color-graphite,#707070);
      }
      .dealer-m-inv-card-thumb img{ width:100%; height:100%; object-fit:cover; }
      .dealer-m-inv-card-body{
        flex:1;
        min-width:0;
        display:flex;
        flex-direction:column;
        gap:2px;
      }
      .dealer-m-inv-card-name{
        font-size:var(--t-callout);
        font-weight:600;
        color:var(--color-ink,#1d1d1f);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .dealer-m-inv-card-sub{ font-size:var(--t-footnote); color:var(--color-graphite,#707070); }
      .dealer-m-inv-card-right{
        flex-shrink:0;
        display:flex;
        flex-direction:column;
        align-items:flex-end;
        gap:4px;
      }
      /* Stock reads as a colored dot + word FIRST, unit count second (spec
         §4.1) - never a bare number leading the row. */
      .dealer-m-inv-card-status{
        display:inline-flex;
        align-items:center;
        gap:5px;
        font-size:var(--t-caption);
        font-weight:600;
      }
      .dealer-m-inv-card-status-dot{ width:6px; height:6px; border-radius:999px; flex-shrink:0; }
      .dealer-m-inv-card-qty{ font-size:var(--t-caption); color:var(--color-graphite,#707070); font-variant-numeric:tabular-nums; }
      .dealer-m-inv-history-wrap{ margin-top:16px; }

      /* ---- DealerInventoryDetailMobileView ---- */
      .dealer-m-invd{ padding-block:4px 24px; padding-inline:var(--dealer-m-gutter); }
      .dealer-m-invd-identity{
        margin-top:16px;
        display:flex;
        align-items:center;
        gap:12px;
        padding:14px;
        border-radius:18px;
        background:var(--color-snow,#fff);
      }
      .dealer-m-invd-thumb{
        width:56px;
        height:56px;
        border-radius:14px;
        background:var(--color-fog,#f5f5f7);
        display:grid;
        place-items:center;
        overflow:hidden;
        flex-shrink:0;
        color:var(--color-graphite,#707070);
      }
      .dealer-m-invd-thumb img{ width:100%; height:100%; object-fit:cover; }
      .dealer-m-invd-identity-body{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
      .dealer-m-invd-name{
        font-size:var(--t-callout);
        font-weight:700;
        color:var(--color-ink,#1d1d1f);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .dealer-m-invd-sub{ font-size:var(--t-footnote); color:var(--color-graphite,#707070); }
      .dealer-m-invd-stats{
        margin-top:12px;
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      }
      .dealer-m-invd-stat{
        padding:12px 14px;
        border-radius:16px;
        background:var(--color-snow,#fff);
      }
      .dealer-m-invd-stat-value{
        font-size:var(--t-body-lg);
        font-weight:700;
        font-variant-numeric:tabular-nums;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-invd-stat-label{
        margin-top:2px;
        font-size:var(--t-caption);
        color:var(--color-graphite,#707070);
      }
      .dealer-m-invd > .dealer-m-segmented{ margin-top:14px; }
      .dealer-m-invd-overview{
        margin-top:14px;
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:16px;
        padding:16px;
        border-radius:18px;
        background:var(--color-snow,#fff);
      }
      .dealer-m-invd-field-label{
        font-size:var(--t-caption2);
        font-weight:700;
        letter-spacing:.04em;
        text-transform:uppercase;
        color:var(--color-graphite,#707070);
      }
      .dealer-m-invd-field-value{
        margin-top:4px;
        font-size:var(--t-subhead);
        font-weight:600;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-invd-history{ margin-top:14px; }

      /* ---- DealerSalesMobileView ---- */
      .dealer-m-sales{ padding-block:4px 24px; padding-inline:var(--dealer-m-gutter); }
      .dealer-m-sales-new-btn{
        width:32px; height:32px;
        border-radius:999px;
        border:none;
        background:var(--color-ink,#1d1d1f);
        color:#fff;
        display:grid;
        place-items:center;
        cursor:pointer;
        transition:transform 120ms ease-out;
      }
      .dealer-m-sales-new-btn:active{ transform:scale(0.9); }
      .dealer-m-sales .dealer-m-home-stats{ margin-top:16px; }
      .dealer-m-sales-timeline{ margin-top:20px; display:flex; flex-direction:column; gap:24px; }
      .dealer-m-sales-day{ display:flex; flex-direction:column; }
      /* Sticky day dividers (spec §4.2, "§2.1 style") - same translucent
         blur treatment as the compact header, but one per day group so
         each hands off to the next as the timeline scrolls (a plain
         multi-sibling position:sticky stack, no extra JS). */
      .dealer-m-sales-day-label{
        position:sticky;
        z-index:40;
        margin-inline:calc(var(--dealer-m-gutter) * -1);
        padding:10px var(--dealer-m-gutter) 8px;
        background:rgba(245,245,247,.86);
        -webkit-backdrop-filter:saturate(180%) blur(20px);
        backdrop-filter:saturate(180%) blur(20px);
        font-size:var(--t-footnote);
        font-weight:700;
        letter-spacing:.02em;
        text-transform:uppercase;
        color:var(--color-graphite,#707070);
      }
      .dealer-m-sales-day-cards{
        margin-top:8px;
        display:flex;
        flex-direction:column;
        gap:12px;
      }
      .dealer-m-sales-card{
        width:100%;
        display:flex;
        align-items:center;
        gap:12px;
        padding:12px 14px;
        border:none;
        border-radius:16px;
        background:var(--color-snow,#fff);
        cursor:pointer;
        text-align:left;
        transition:transform 120ms ease-out;
      }
      .dealer-m-sales-card:active{ transform:scale(0.98); }
      .dealer-m-sales-card-avatar{
        width:32px; height:32px;
        border-radius:999px;
        display:grid;
        place-items:center;
        flex-shrink:0;
        overflow:hidden;
        background:rgba(22,163,74,.1);
        color:#15803d;
      }
      .dealer-m-sales-card-avatar.voided{ background:rgba(180,35,24,.1); color:#b42318; }
      .dealer-m-sales-card-avatar img{ width:100%; height:100%; object-fit:cover; }
      .dealer-m-sales-card-body{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
      .dealer-m-sales-card-title{
        display:flex;
        align-items:center;
        gap:6px;
        font-size:var(--t-subhead);
        font-weight:600;
        color:var(--color-ink,#1d1d1f);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .dealer-m-sales-card-voided{
        flex-shrink:0;
        font-size:var(--t-caption2);
        font-weight:700;
        padding:1px 6px;
        border-radius:999px;
        background:rgba(180,35,24,.1);
        color:#b42318;
      }
      .dealer-m-sales-card-sub{ font-size:var(--t-caption); color:var(--color-graphite,#707070); }
      .dealer-m-sales-card-right{ flex-shrink:0; display:flex; flex-direction:column; align-items:flex-end; gap:2px; }
      .dealer-m-sales-card-amount{ font-size:var(--t-subhead); font-weight:700; font-variant-numeric:tabular-nums; color:var(--color-ink,#1d1d1f); }
      .dealer-m-sales-card-time{ font-size:var(--t-caption); color:var(--color-graphite,#707070); }

      /* ---- Sale detail sheet ---- */
      .dealer-m-sale-detail-title{
        display:flex;
        align-items:center;
        gap:8px;
        font-size:var(--t-headline);
        font-weight:700;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-sale-detail-sub{ margin-top:4px; font-size:var(--t-footnote); color:var(--color-graphite,#707070); }
      .dealer-m-sale-detail-items{ margin-top:16px; display:flex; flex-direction:column; gap:6px; }
      .dealer-m-sale-detail-item{
        display:flex;
        justify-content:space-between;
        gap:10px;
        padding:10px 12px;
        border-radius:12px;
        background:var(--color-fog,#f5f5f7);
        font-size:var(--t-footnote);
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-sale-detail-item-total{ font-weight:700; }
      .dealer-m-sale-detail-total-row{
        margin-top:12px;
        display:flex;
        justify-content:space-between;
        padding:12px 14px;
        border-radius:12px;
        background:rgba(0,113,227,.06);
        font-size:var(--t-subhead);
        font-weight:700;
      }
      .dealer-m-sale-detail-total-value{ color:var(--color-azure,#0071e3); }
      .dealer-m-sale-detail-notes{ margin-top:12px; font-size:var(--t-footnote); color:var(--color-graphite,#707070); }
      .dealer-m-sale-detail-voided{ margin-top:14px; font-size:var(--t-footnote); font-weight:600; color:#b42318; }
      /* ---- Sale detail: void (spec §6-style danger zone, mobile-only) ----
         Kept collapsed behind a trigger by default so opening a sale to
         just glance at the receipt doesn't compete for attention with a
         destructive action; expanding it commits to a Cancel/Confirm pair
         instead of one tap-and-done button (V3 §5.2 confirm-before-destroy
         convention used elsewhere in the dealer app). */
      .dealer-m-sale-detail-manage{ margin-top:18px; }
      .dealer-m-sale-detail-divider{ border-top:1px solid rgba(29,29,31,.06); margin-bottom:10px; }
      .dealer-m-sale-void-trigger{
        width:100%;
        height:44px;
        border-radius:12px;
        border:none;
        background:none;
        color:#b42318;
        font-size:var(--t-subhead);
        font-weight:600;
        cursor:pointer;
        transition:transform 120ms ease-out, background-color 120ms ease-out;
      }
      .dealer-m-sale-void-trigger:active{ transform:scale(0.98); background:rgba(180,35,24,.06); }
      .dealer-m-sale-detail-void{ display:flex; flex-direction:column; gap:8px; }
      .dealer-m-sale-detail-void-actions{ display:flex; align-items:center; gap:14px; }
      .dealer-m-sale-detail-void-actions .dealer-m-newsale-ghost{ flex-shrink:0; }
      .dealer-m-sale-void-btn{
        flex:1;
        height:44px;
        border-radius:12px;
        border:1.5px solid rgba(180,35,24,.3);
        background:rgba(180,35,24,.06);
        color:#b42318;
        font-size:var(--t-subhead);
        font-weight:700;
        cursor:pointer;
        transition:transform 120ms ease-out;
      }
      .dealer-m-sale-void-btn:active{ transform:scale(0.98); }
      .dealer-m-sale-void-btn:disabled, .dealer-m-sale-detail-void-actions .dealer-m-newsale-ghost:disabled{ opacity:.5; cursor:not-allowed; }

      /* ---- NewSaleMobileSheet ---- */
      .dealer-m-newsale-title{ font-size:var(--t-title3); font-weight:700; letter-spacing:-0.02em; color:var(--color-ink,#1d1d1f); }
      .dealer-m-newsale-field-label{
        margin-top:18px;
        font-size:var(--t-caption);
        font-weight:700;
        letter-spacing:.04em;
        text-transform:uppercase;
        color:var(--color-graphite,#707070);
      }
      .dealer-m-newsale-input{
        margin-top:8px;
        width:100%;
        height:48px;
        border-radius:16px;
        border:none;
        background:var(--color-fog,#f5f5f7);
        padding:0 16px;
        /* V3 §3 exception - iOS zoom guard, bumped up from 15px to 16px. */
        font-size:16px;
        color:var(--color-ink,#1d1d1f);
        outline:none;
      }
      .dealer-m-newsale-textarea{
        margin-top:8px;
        width:100%;
        border-radius:16px;
        border:none;
        background:var(--color-fog,#f5f5f7);
        padding:14px 16px;
        /* V3 §3 exception - iOS zoom guard, bumped up from 15px to 16px. */
        font-size:16px;
        color:var(--color-ink,#1d1d1f);
        outline:none;
        resize:vertical;
        font-family:inherit;
      }
      .dealer-m-newsale-products-head{
        margin-top:18px;
        display:flex;
        align-items:center;
        justify-content:space-between;
      }
      .dealer-m-newsale-products-head .dealer-m-newsale-field-label{ margin-top:0; }
      .dealer-m-newsale-add{
        border:none;
        background:none;
        color:var(--color-azure,#0071e3);
        font-size:var(--t-footnote);
        font-weight:700;
        cursor:pointer;
        transition:transform 120ms ease-out;
      }
      .dealer-m-newsale-add:active{ transform:scale(0.95); }
      .dealer-m-newsale-empty{
        margin-top:10px;
        padding:20px;
        border-radius:16px;
        background:var(--color-fog,#f5f5f7);
        text-align:center;
        font-size:var(--t-footnote);
        font-weight:600;
        color:var(--color-graphite,#707070);
      }
      .dealer-m-newsale-lines{ margin-top:10px; display:flex; flex-direction:column; gap:10px; }
      .dealer-m-newsale-line{
        padding:14px;
        border-radius:16px;
        background:var(--color-fog,#f5f5f7);
        display:flex;
        flex-direction:column;
        gap:8px;
      }
      .dealer-m-newsale-line-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .dealer-m-newsale-line-name{
        font-size:var(--t-subhead);
        font-weight:700;
        color:var(--color-ink,#1d1d1f);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .dealer-m-newsale-change{ flex-shrink:0; border:none; background:none; color:var(--color-azure,#0071e3); font-size:var(--t-footnote); font-weight:700; cursor:pointer; }
      .dealer-m-newsale-line-sub{ font-size:var(--t-caption); color:var(--color-graphite,#707070); }
      .dealer-m-newsale-line-row{ margin-top:2px; display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .dealer-m-newsale-remove{ border:none; background:none; color:#b42318; font-size:var(--t-footnote); font-weight:700; cursor:pointer; }
      .dealer-m-newsale-results{ display:flex; flex-direction:column; gap:6px; max-height:220px; overflow:auto; }
      .dealer-m-newsale-result-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        width:100%;
        padding:10px 12px;
        border-radius:12px;
        border:none;
        background:var(--color-snow,#fff);
        cursor:pointer;
        text-align:left;
      }
      .dealer-m-newsale-result-row:disabled{ opacity:.5; cursor:not-allowed; }
      .dealer-m-newsale-result-name{
        font-size:var(--t-footnote);
        font-weight:600;
        color:var(--color-ink,#1d1d1f);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .dealer-m-newsale-result-qty{ flex-shrink:0; font-size:var(--t-caption); font-weight:600; color:var(--color-graphite,#707070); }
      .dealer-m-newsale-hint{ font-size:var(--t-footnote); color:var(--color-graphite,#707070); }
      .dealer-m-newsale-line-actions{ display:flex; gap:10px; }
      .dealer-m-newsale-ghost{
        border:none;
        background:none;
        color:var(--color-graphite,#707070);
        font-size:var(--t-footnote);
        font-weight:700;
        cursor:pointer;
      }
      .dealer-m-newsale-ghost.danger{ color:#b42318; }
      .dealer-m-newsale-error{
        margin-top:12px;
        padding:10px 12px;
        border-radius:12px;
        background:rgba(180,35,24,.08);
        color:#b42318;
        font-size:var(--t-footnote);
        font-weight:600;
      }

      /* ---- DealerMoreDrawer (spec §4.3, Apple-Settings grouped lists) ---- */
      .dealer-m-more-title{ font-size:var(--t-title3); font-weight:700; letter-spacing:-0.02em; color:var(--color-ink,#1d1d1f); }
      .dealer-m-more-group{ margin-top:20px; }
      .dealer-m-more-group:first-of-type{ margin-top:14px; }
      .dealer-m-more-group-label{
        padding:0 4px 8px;
        font-size:var(--t-caption);
        font-weight:700;
        letter-spacing:.04em;
        text-transform:uppercase;
        color:var(--color-graphite,#707070);
      }
      .dealer-m-more-card{
        border-radius:18px;
        background:var(--color-snow,#fff);
        overflow:hidden;
      }
      .dealer-m-more-row{
        width:100%;
        min-height:52px;
        display:flex;
        align-items:center;
        gap:12px;
        padding:0 16px;
        border:none;
        background:transparent;
        cursor:pointer;
        text-align:left;
        transition:transform 120ms ease-out, background 120ms ease-out;
      }
      .dealer-m-more-row:not(:last-child){ border-bottom:1px solid rgba(29,29,31,.06); }
      .dealer-m-more-row:active{ transform:scale(0.98); background:rgba(29,29,31,.03); }
      .dealer-m-more-row-icon{
        flex-shrink:0;
        width:24px;
        height:24px;
        display:grid;
        place-items:center;
        color:var(--color-graphite,#707070);
      }
      /* Logout stays plain ink, never red (spec §4.3) - active-section tint
         is the only color variance a More row ever gets. */
      .dealer-m-more-row.active .dealer-m-more-row-icon{ color:var(--color-azure,#0071e3); }
      .dealer-m-more-row-label{ flex:1; min-width:0; font-size:var(--t-body); font-weight:500; color:var(--color-ink,#1d1d1f); }
      .dealer-m-more-row-chevron{ flex-shrink:0; color:rgba(29,29,31,.25); }

      /* ---- DealerOrderDetailMobileView ---- */
      .dealer-m-order-detail{ padding-block:4px 24px; padding-inline:var(--dealer-m-gutter); }
      .dealer-m-order-hero{ margin-top:22px; }
      .dealer-m-order-hero-headline{
        font-size:var(--t-title2);
        font-weight:700;
        letter-spacing:-0.01em;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-order-hero-sub{
        margin-top:6px;
        font-size:var(--t-callout);
        color:var(--color-graphite,#707070);
      }
      .dealer-m-order-card{
        margin-top:18px;
        padding:20px 16px;
        border-radius:20px;
        background:var(--color-snow,#fff);
      }
      .dealer-m-order-chip-row{
        margin-top:14px;
        display:flex;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
      }
      .dealer-m-order-chip{
        height:26px;
        padding:0 10px;
        border-radius:999px;
        background:var(--color-fog,#f5f5f7);
        color:var(--color-ink,#1d1d1f);
        font-size:var(--t-footnote);
        font-weight:600;
        display:inline-flex;
        align-items:center;
      }
      .dealer-m-order-chip-link{
        display:inline-flex;
        align-items:center;
        gap:5px;
        border:none;
        background:none;
        color:var(--color-azure,#0071e3);
        font-size:var(--t-footnote);
        font-weight:600;
        cursor:pointer;
        transition:transform 120ms ease-out;
      }
      .dealer-m-order-chip-link:active:not(:disabled){ transform:scale(0.96); }
      .dealer-m-order-chip-link:disabled{
        color:var(--color-graphite,#707070);
        cursor:not-allowed;
      }
      .dealer-m-order-items-card{
        margin-top:14px;
        padding:16px;
        border-radius:20px;
        background:var(--color-snow,#fff);
      }
      .dealer-m-order-items-title{
        font-size:var(--t-caption);
        font-weight:700;
        letter-spacing:.04em;
        text-transform:uppercase;
        color:var(--color-graphite,#707070);
      }
      .dealer-m-order-item-group{
        margin-top:14px;
        padding-top:14px;
        border-top:1px solid rgba(29,29,31,.06);
      }
      .dealer-m-order-item-group:first-of-type{ border-top:none; margin-top:10px; padding-top:0; }
      /* Order Detail drops the hairline between the product name row and
         its first size/quantity line - .dealer-m-cart-line is shared with
         the Cart (checkout) page, which still wants that divider, so this
         is scoped to .dealer-m-order-item-group rather than touching the
         shared rule. Only the line right after the head loses it; a second
         pack size within the same group still gets its own divider. */
      .dealer-m-order-item-group .dealer-m-cart-card-head + .dealer-m-cart-line{
        border-top:none;
        margin-top:8px;
        padding-top:0;
      }
      /* Cart truncates long product names to one line (editing controls
         need the horizontal room) - .dealer-m-cart-card-name is shared with
         the Cart page, so this override is scoped to .dealer-m-order-item-
         group instead of touching the shared rule. Order Detail is a
         read-only record the dealer revisits later, so the full name should
         always be legible rather than clipped with an ellipsis. */
      .dealer-m-order-item-group .dealer-m-cart-card-name{
        white-space:normal;
        overflow:visible;
        text-overflow:clip;
      }
      .dealer-m-order-items-total{
        margin-top:14px;
        padding-top:14px;
        border-top:1px solid rgba(29,29,31,.08);
        display:flex;
        justify-content:space-between;
        font-size:var(--t-body-lg);
        font-weight:700;
        color:var(--color-ink,#1d1d1f);
      }

      /* ---- DealerOrdersMobileView ---- */
      .dealer-m-orders{ padding-block:4px 24px; padding-inline:var(--dealer-m-gutter); }
      .dealer-m-orders .dealer-m-segmented{ margin-top:14px; }
      .dealer-m-orders-month{ margin-top:22px; }
      .dealer-m-orders-month:first-of-type{ margin-top:16px; }
      .dealer-m-orders-month-label{
        font-size:var(--t-footnote);
        font-weight:700;
        letter-spacing:.02em;
        text-transform:uppercase;
        color:var(--color-graphite,#707070);
      }
      /* Detached-card list (spec §1.4) - each order is its own white card,
         never rows sharing one slab, so cards read as distinct objects the
         way the Uber Eats order-history pattern does. */
      .dealer-m-orders-list{
        margin-top:10px;
        display:flex;
        flex-direction:column;
        gap:12px;
      }
      .dealer-m-orders-card{
        position:relative;
        width:100%;
        display:flex;
        align-items:center;
        gap:12px;
        padding:14px 16px;
        border:none;
        border-radius:18px;
        background:var(--color-snow,#fff);
        cursor:pointer;
        text-align:left;
        overflow:hidden;
        transition:transform 120ms ease-out;
      }
      .dealer-m-orders-card:active{ transform:scale(0.98); }
      .dealer-m-orders-card.live::before{
        content:"";
        position:absolute;
        left:0; top:0; bottom:0;
        width:3px;
        background:var(--color-azure,#0071e3);
      }
      .dealer-m-orders-card-thumb{
        position:relative;
        width:44px;
        height:44px;
        border-radius:12px;
        background:var(--color-fog,#f5f5f7);
        display:grid;
        place-items:center;
        overflow:hidden;
        flex-shrink:0;
        color:var(--color-graphite,#707070);
      }
      .dealer-m-orders-card-thumb img{ width:100%; height:100%; object-fit:cover; }
      .dealer-m-orders-card-badge{
        position:absolute;
        right:-2px;
        bottom:-2px;
        min-width:16px;
        height:16px;
        padding:0 3px;
        border-radius:999px;
        background:var(--color-ink,#1d1d1f);
        color:#fff;
        font-size:var(--t-caption2);
        font-weight:700;
        display:grid;
        place-items:center;
        border:1.5px solid var(--color-snow,#fff);
      }
      .dealer-m-orders-card-body{
        flex:1;
        min-width:0;
        display:flex;
        flex-direction:column;
        gap:2px;
      }
      .dealer-m-orders-card-number{
        font-size:var(--t-callout);
        font-weight:600;
        color:var(--color-ink,#1d1d1f);
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .dealer-m-orders-card-meta{
        font-size:var(--t-footnote);
        color:var(--color-graphite,#707070);
      }
      .dealer-m-orders-card-right{
        flex-shrink:0;
        display:flex;
        flex-direction:column;
        align-items:flex-end;
        gap:6px;
      }
      .dealer-m-orders-card-total{
        font-size:var(--t-callout);
        font-weight:700;
        font-variant-numeric:tabular-nums;
        color:var(--color-ink,#1d1d1f);
      }
      .dealer-m-orders-card-status-row{
        display:flex;
        align-items:center;
        gap:2px;
      }
      .dealer-m-orders-card-chevron{ color:var(--color-graphite,#707070); flex-shrink:0; }
      /* V3 §5.6: swipe-left-to-reorder, same reveal-behind-a-foreground-
         layer shape as the cart's swipe-to-remove (§4.4) - the azure
         action sits absolutely behind, .dealer-m-orders-card (unchanged
         base rule, already has its own opaque background) is the
         translating foreground, dragged via useSwipeAction's ref/handlers. */
      .dealer-m-orders-card-wrap{
        position:relative;
        border-radius:18px;
        overflow:hidden;
      }
      .dealer-m-orders-card-wrap .dealer-m-orders-card{ position:relative; z-index:1; }
      .dealer-m-orders-card-reorder-action{
        position:absolute;
        inset:0;
        left:auto;
        width:96px;
        border:none;
        background:var(--color-azure,#0071e3);
        color:#fff;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:2px;
        font-size:var(--t-caption);
        font-weight:600;
        cursor:pointer;
      }
      /* First-screenful stagger, once per mount (spec §1.4/§3): fade + 8px
         rise, 40ms/card via inline animation-delay set by the caller. */
      .dealer-m-orders-card-stagger{
        animation:dealerOrdersCardIn 320ms var(--ease-out-strong, ease-out) both;
      }
      @keyframes dealerOrdersCardIn{
        from{ opacity:0; transform:translateY(8px); }
        to{ opacity:1; transform:translateY(0); }
      }

      @media (prefers-reduced-motion: reduce){
        .dealer-m-placed-check{ animation:dealerOrdersCardInReduced 200ms ease both; }
        .dealer-m-placed-check-path{ animation:none; stroke-dashoffset:0; }
        .dealer-m-placed-stage-2,
        .dealer-m-placed-stage-3,
        .dealer-m-placed-stage-4{ animation:dealerOrdersCardInReduced 200ms ease both; animation-delay:0ms; }
        .dealer-m-status-rail-dot-current{ animation:none; }
        .dealer-m-primary-btn, .dealer-m-stepper-btn{ transition:none; }
        .dealer-m-cart-pill{ transition:none; }
        .dealer-m-cart-pill-text-roll{ animation:none; }
        .dealer-m-refetch-hairline::after,
        .dealer-m-skel,
        .dealer-m-home-skeleton-line,
        .dealer-m-home-skeleton-card{ animation:none; }
        /* Sheet enter/exit collapse to a plain 150ms opacity fade rather than
           the translateY slide - drag-to-dismiss keeps working as-is under
           reduced motion (direct manipulation, not decoration), since this
           only touches the animation property, never the drag's own inline
           transform writes. */
        .dealer-m-sheet, .dealer-m-sheet-scrim{ animation:dealerOrdersCardInReduced 150ms ease both; }
        .dealer-m-sheet.closing, .dealer-m-sheet-scrim.closing{ animation:dealerFadeOutReduced 150ms ease both; }
        .dealer-m-toast{ transition:opacity 200ms ease; transform:none !important; }
        .dealer-m-sheet-pack-check{ animation:none; }
        .dealer-m-tabbar-icon-bounce{ animation:none; }
        .dealer-m-tabbar-item{ transition:none; }
        .dealer-m-orders-card-stagger{ animation:dealerOrdersCardInReduced 200ms ease both; }
        .dealer-m-status-rail-node-stagger{ animation:dealerOrdersCardInReduced 200ms ease both; animation-delay:0ms; }
        .dealer-m-large-title-group{ transform:none !important; }
        .dealer-m-home-stagger{ animation:dealerOrdersCardInReduced 200ms ease both; }
        .dealer-m-home-live-card .dealer-m-status-rail-dot-current{ animation:none; }
        .dealer-m-catalog-search-overlay-field,
        .dealer-m-catalog-search-cancel{ animation:dealerOrdersCardInReduced 150ms ease both; }
        .dealer-m-catalog-search-overlay.closing .dealer-m-catalog-search-overlay-field,
        .dealer-m-catalog-search-overlay.closing .dealer-m-catalog-search-cancel{ animation:dealerFadeOutReduced 150ms ease both; }
      }
      @keyframes dealerOrdersCardInReduced{
        from{ opacity:0; }
        to{ opacity:1; }
      }
      @keyframes dealerFadeOutReduced{
        from{ opacity:1; }
        to{ opacity:0; }
      }
    `}</style>
  );
}
