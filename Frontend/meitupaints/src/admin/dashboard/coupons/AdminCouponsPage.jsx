import { useState } from "react";

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
  const [tab, setTab] = useState("generate");
  const [toast, setToast] = useState(null);

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
