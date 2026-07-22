// Admin mobile design tokens (ADMIN_MOBILE_DESIGN_PROMPT.md §1), scoped
// under .admin-m so they never leak into desktop admin or other roles.
// Structural chrome (tab bar, sheets, toast, push headers) deliberately
// reuses the existing .dealer-m-* CSS classes as-is (see AdminBottomTabBar.jsx's
// header comment) rather than re-declaring them here - this file only
// carries the tokens and rules that are genuinely admin-specific.
export function AdminMobileStyles() {
  return (
    <style>{`
      .admin-m{
        --am-gutter: 16px;
        --am-radius: 20px;
        --am-gap: 12px;
        --am-hero: 32px;
        --am-display: 24px;
        --am-title: 17px;
        --am-body: 14px;
        --am-meta: 12px;
      }

      .admin-m{
        padding: var(--am-gutter);
        padding-bottom: calc(var(--am-gutter) + 64px + env(safe-area-inset-bottom, 0px));
        display: grid;
        gap: 24px;
      }

      .admin-m *{
        box-sizing: border-box;
      }

      .admin-m table{
        display: none;
      }

      .admin-m-section-title{
        font-size: 13px;
        font-weight: 700;
        letter-spacing: .02em;
        text-transform: uppercase;
        color: var(--color-graphite, #707070);
        padding: 0 2px;
      }

      .admin-m-card{
        background: var(--color-snow, #fff);
        border-radius: var(--am-radius);
        padding: 16px;
      }

      .admin-m-card-list{
        display: grid;
        gap: var(--am-gap);
      }

      .admin-m-money{
        font-variant-numeric: tabular-nums;
      }

      /* Needs-attention snap shelf (ADMIN_MOBILE_DESIGN_PROMPT.md §2) - same
         full-bleed horizontal-scroll grammar as .dealer-m-catalog-chips,
         card-sized rather than pill-sized since each entry carries a
         count + label, not just a filter name. */
      .admin-m-shelf{
        display: flex;
        gap: 10px;
        margin-top: 10px;
        overflow-x: auto;
        padding-bottom: 2px;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
        margin-inline: calc(var(--am-gutter) * -1);
        padding-inline: var(--am-gutter);
      }
      .admin-m-shelf-card{
        flex: 0 0 auto;
        width: 128px;
        scroll-snap-align: start;
        border: none;
        border-radius: 18px;
        background: var(--color-snow, #fff);
        padding: 14px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        text-align: left;
        cursor: pointer;
        transition: transform 120ms ease-out;
      }
      .admin-m-shelf-card:active{ transform: scale(0.96); }
      .admin-m-shelf-icon{
        width: 32px;
        height: 32px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: rgba(0,113,227,.08);
        color: var(--color-azure, #0071e3);
      }
      .admin-m-shelf-value{
        font-size: 22px;
        font-weight: 800;
        color: var(--color-ink, #1d1d1f);
        font-variant-numeric: tabular-nums;
      }
      .admin-m-shelf-label{
        font-size: 12px;
        font-weight: 600;
        line-height: 1.3;
        color: var(--color-graphite, #707070);
      }

      /* Operational feed rows - reuses .admin-m-card as the row surface. */
      .admin-m-feed-row{
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        text-align: left;
        border: none;
        cursor: pointer;
        transition: transform 120ms ease-out;
      }
      .admin-m-feed-row:active{ transform: scale(0.98); }
      .admin-m-feed-icon{
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: var(--color-fog, #f5f5f7);
        color: var(--color-ink, #1d1d1f);
      }
      .admin-m-feed-title{
        display: block;
        font-size: 13.5px;
        font-weight: 700;
        color: var(--color-ink, #1d1d1f);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .admin-m-feed-detail{
        display: block;
        margin-top: 2px;
        font-size: 12px;
        font-weight: 600;
        color: var(--color-graphite, #707070);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Orders list swipe-reveal (ADMIN_MOBILE_DESIGN_PROMPT.md §3) - same
         absolute-behind-the-card layer as .dealer-m-orders-card-reorder-
         action, sized for two side-by-side actions instead of one. Reuses
         .dealer-m-orders-card-wrap/.dealer-m-orders-card as the swipe host
         (see AdminOrdersMobileView.jsx). */
      .admin-m-order-swipe-actions{
        position: absolute;
        inset: 0;
        left: auto;
        width: 168px;
        display: flex;
      }
      .admin-m-order-swipe-verify,
      .admin-m-order-swipe-reject{
        flex: 1;
        border: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        font-size: 12px;
        font-weight: 600;
        color: #fff;
        cursor: pointer;
      }
      .admin-m-order-swipe-verify{ background: var(--color-azure, #0071e3); }
      .admin-m-order-swipe-reject{ background: #b42318; }

      /* Catalog mobile (ADMIN_MOBILE_DESIGN_PROMPT.md §4) - family/variant
         row cards mirror .dealer-m-catalog-card's image+body shell, and the
         product editor sheet's form fields reuse the .dealer-m-newsale-*
         input/label vocabulary (see AdminOrderConfirmSheet.jsx's own
         precedent) for text inputs, plus a couple of genuinely admin-only
         additions here: a native <select> styled to match, and a small
         label+value row for read-only family metadata. */
      .admin-m-catalog-card{
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border: none;
        border-radius: 18px;
        background: var(--color-snow, #fff);
        cursor: pointer;
        text-align: left;
        transition: transform 120ms ease-out;
      }
      .admin-m-catalog-card:active{ transform: scale(0.98); }
      .admin-m-catalog-thumb{
        flex-shrink: 0;
        width: 56px;
        height: 56px;
        border-radius: 14px;
        background: var(--color-fog, #f5f5f7);
        display: grid;
        place-items: center;
        overflow: hidden;
        color: var(--color-graphite, #707070);
      }
      .admin-m-catalog-thumb img{ width: 100%; height: 100%; object-fit: contain; }
      .admin-m-catalog-body{ flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .admin-m-catalog-name{
        font-size: 14.5px;
        font-weight: 700;
        color: var(--color-ink, #1d1d1f);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .admin-m-catalog-meta{
        font-size: 12.5px;
        font-weight: 500;
        color: var(--color-graphite, #707070);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .admin-m-select{
        margin-top: 8px;
        width: 100%;
        height: 48px;
        border-radius: 16px;
        border: none;
        background: var(--color-fog, #f5f5f7);
        padding: 0 14px;
        font-size: 16px;
        color: var(--color-ink, #1d1d1f);
        outline: none;
        appearance: none;
        -webkit-appearance: none;
      }
      .admin-m-kv-row{
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 0;
        border-top: 1px solid rgba(29,29,31,.06);
      }
      .admin-m-kv-row:first-child{ border-top: none; }
      .admin-m-tier-row{
        display: grid;
        grid-template-columns: minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 36px;
        gap: 6px;
        align-items: center;
        padding: 8px;
        border-radius: 12px;
        background: var(--color-fog, #f5f5f7);
      }
      .admin-m-tier-input{
        width: 100%;
        height: 38px;
        border-radius: 10px;
        border: none;
        background: var(--color-snow, #fff);
        padding: 0 8px;
        font-size: 13px;
        font-weight: 600;
        color: var(--color-ink, #1d1d1f);
        outline: none;
        min-width: 0;
      }
      .admin-m-tier-remove{
        width: 32px;
        height: 32px;
        border-radius: 9px;
        border: none;
        background: var(--color-snow, #fff);
        color: #b42318;
        display: grid;
        place-items: center;
        cursor: pointer;
      }
      .admin-m-tier-remove:disabled{ color: rgba(0,0,0,.2); cursor: not-allowed; }
      .admin-m-image-well{
        width: 88px;
        height: 88px;
        border-radius: 20px;
        background: var(--color-fog, #f5f5f7);
        display: grid;
        place-items: center;
        overflow: hidden;
        color: var(--color-graphite, #707070);
      }
      .admin-m-image-well img{ width: 100%; height: 100%; object-fit: contain; }
      .admin-m-image-actions{ display: flex; gap: 8px; margin-top: 10px; }
      .admin-m-image-btn{
        height: 34px;
        padding: 0 14px;
        border-radius: 999px;
        border: none;
        background: var(--color-fog, #f5f5f7);
        color: var(--color-ink, #1d1d1f);
        font-size: 12.5px;
        font-weight: 700;
        cursor: pointer;
      }
      .admin-m-image-btn.danger{ color: #b42318; }

      @media (hover: hover) and (pointer: fine){
        .admin-m button:hover{
          opacity: .92;
        }
      }

      .admin-m button:active{
        transform: scale(0.97);
        transition: transform 120ms ease-out;
      }
    `}</style>
  );
}
