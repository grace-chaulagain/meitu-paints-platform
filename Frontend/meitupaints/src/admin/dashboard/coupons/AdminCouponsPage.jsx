import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { DashboardUIStyles, TabBar } from "../../../components/dashboard/DashboardUI.jsx";
import { Toast } from "../../../components/dashboard/Toast.jsx";
import { COUPON_TABS } from "./couponFormatting.js";
import GenerateTab from "./tabs/GenerateTab.jsx";
import CatalogTab from "./tabs/CatalogTab.jsx";
import BatchesTab from "./tabs/BatchesTab.jsx";
import HistoryTab from "./tabs/HistoryTab.jsx";
import AttemptsTab from "./tabs/AttemptsTab.jsx";
import SettlementTab from "./tabs/SettlementTab.jsx";

export default function AdminCouponsPage() {
  // The tab lives in the URL so one redemption row can link straight to
  // "this dealer's history" - see HistoryTab's See redeem history action.
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const tab = COUPON_TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "generate";
  const [toast, setToast] = useState(null);

  function setTab(next) {
    const search = new URLSearchParams(location.search);
    if (next === "generate") search.delete("tab");
    else search.set("tab", next);
    // Switching tabs by hand drops any per-dealer filter the previous tab carried.
    search.delete("dealerId");
    search.delete("dispatcherId");
    search.delete("actorName");
    navigate({ pathname: location.pathname, search: search.toString() ? `?${search}` : "" }, { replace: true });
  }

  return (
    <div className="admin-coupons-page">
      <DashboardUIStyles />
      <TabBar options={COUPON_TABS} value={tab} onChange={setTab} />

      <div className="admin-coupons-content">
        {tab === "generate" ? (
          <GenerateTab onToast={setToast} />
        ) : tab === "catalog" ? (
          <CatalogTab onToast={setToast} />
        ) : tab === "coupons" ? (
          <BatchesTab onToast={setToast} />
        ) : tab === "history" ? (
          <HistoryTab />
        ) : tab === "attempts" ? (
          <AttemptsTab />
        ) : (
          <SettlementTab />
        )}
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <style>{`
        .admin-coupons-page{
          display:grid;
          gap:16px;
          color:var(--color-ink, #1d1d1f);
          font-family:var(--font-sf-pro-text, Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif);
        }
        .admin-coupons-content{
          display:grid;
          gap:16px;
        }
        .admin-coupons-error{
          padding:12px 14px;
          border-radius:12px;
          background:rgba(180,35,24,.08);
          color:#b42318;
          font-size:13px;
          font-weight:600;
        }
        /* --- dealer search + per-dealer history --- */
        .coupon-history-search{ position:relative; display:inline-flex; }
        .coupon-history-suggest{
          position:absolute; top:calc(100% + 6px); left:0; z-index:40;
          min-width:260px; max-height:250px; overflow-y:auto; padding:4px;
          background:#fff; border:1px solid rgba(29,29,31,.08); border-radius:14px;
          box-shadow:0 12px 30px rgba(0,0,0,.12);
          animation:couponSuggestIn .16s var(--ease-out, cubic-bezier(.23,1,.32,1)) backwards;
        }
        @keyframes couponSuggestIn{ from{ opacity:0; transform:translateY(-4px); } }
        .coupon-history-suggest button{
          width:100%; display:flex; align-items:center; justify-content:space-between; gap:12px;
          padding:9px 10px; border:0; border-radius:10px; background:transparent;
          font:inherit; font-size:13.5px; text-align:left; cursor:pointer; color:var(--color-ink,#1d1d1f);
          transition:background .12s ease;
        }
        .coupon-history-suggest button:hover{ background:var(--color-fog,#f5f5f7); }
        .coupon-history-suggest-name{ font-weight:600; min-width:0; overflow-wrap:anywhere; }
        .coupon-history-suggest-kind{ flex:none; font-size:11.5px; color:var(--color-graphite,#707070); }

        .coupon-history-scope{
          display:inline-flex; align-items:center; gap:8px; height:44px; padding:0 8px 0 14px;
          border-radius:999px; background:rgba(0,113,227,.1); color:var(--color-azure,#0071e3);
          font-size:13.5px; font-weight:600;
        }
        .coupon-history-scope-name{ max-width:190px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .coupon-history-scope button{
          width:22px; height:22px; display:grid; place-items:center; border:0; border-radius:50%;
          background:rgba(0,113,227,.16); color:inherit; cursor:pointer;
        }

        .coupon-history-rowmenu-backdrop{
          position:fixed; inset:0; z-index:1500; display:grid; place-items:center; padding:24px;
          background:rgba(0,0,0,.32); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);
          animation:couponMenuFade .18s ease-out backwards;
        }
        @keyframes couponMenuFade{ from{ opacity:0; } }
        .coupon-history-rowmenu{
          width:min(320px,100%); padding:8px; border-radius:18px; background:#fff;
          box-shadow:0 24px 60px rgba(0,0,0,.24);
          animation:couponMenuIn .2s var(--ease-out, cubic-bezier(.23,1,.32,1)) backwards;
        }
        @keyframes couponMenuIn{ from{ opacity:0; transform:translateY(8px) scale(.97); } }
        .coupon-history-rowmenu-head{
          display:grid; gap:2px; padding:10px 12px 12px;
          border-bottom:1px solid rgba(29,29,31,.07); margin-bottom:6px;
        }
        .coupon-history-rowmenu-head strong{ font-size:14px; overflow-wrap:anywhere; }
        .coupon-history-rowmenu-head span{ font-size:12px; color:var(--color-graphite,#707070); }
        .coupon-history-rowmenu-action,
        .coupon-history-rowmenu-cancel{
          width:100%; display:flex; align-items:center; justify-content:center; gap:8px;
          height:44px; border:0; border-radius:12px; background:transparent;
          font:inherit; font-size:14px; font-weight:600; cursor:pointer; color:var(--color-ink,#1d1d1f);
          transition:background .14s ease, transform .16s var(--ease-out, cubic-bezier(.23,1,.32,1));
        }
        .coupon-history-rowmenu-action{ color:var(--color-azure,#0071e3); }
        .coupon-history-rowmenu-action:hover:not(:disabled),
        .coupon-history-rowmenu-cancel:hover{ background:var(--color-fog,#f5f5f7); }
        .coupon-history-rowmenu-action:active:not(:disabled),
        .coupon-history-rowmenu-cancel:active{ transform:scale(.98); }
        .coupon-history-rowmenu-action:disabled{ opacity:.4; cursor:not-allowed; }
        .coupon-history-rowmenu-cancel{ color:var(--color-graphite,#707070); }

        @media (prefers-reduced-motion: reduce){
          .coupon-history-suggest, .coupon-history-rowmenu, .coupon-history-rowmenu-backdrop{ animation:none; }
          .coupon-history-rowmenu-action, .coupon-history-rowmenu-cancel{ transition:none; }
        }

        .coupon-history-date-field{
          display:flex;
          align-items:center;
          gap:6px;
          font-size:12px;
          font-weight:600;
          color:var(--color-graphite, #707070);
        }
      `}</style>
    </div>
  );
}
