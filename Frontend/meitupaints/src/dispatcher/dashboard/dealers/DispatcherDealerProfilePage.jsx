import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGetDispatcherDealerQuery } from "../../../redux/api/meituApi.js";
import {
  Avatar,
  DashboardUIStyles,
  EmptyState,
  GhostButton,
  Pill,
  SectionHeader,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";

function statusTone(status) {
  if (status === "ACTIVE" || status === "VERIFIED") return "positive";
  if (status === "SUSPENDED") return "critical";
  return "neutral";
}

function DetailItem({ label, value }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase", color: "var(--color-graphite, #707070)" }}>
        {label}
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, fontWeight: 500, color: "var(--color-ink, #1d1d1f)", wordBreak: "break-word" }}>
        {value || "—"}
      </div>
    </div>
  );
}

function extractDealerIdFromPath(pathname) {
  const match = pathname.match(/^\/dispatcher\/dashboard\/dealers\/([^/]+)$/);
  return match?.[1] || "";
}

export default function DispatcherDealerProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const dealerId = useMemo(() => extractDealerIdFromPath(location.pathname), [location.pathname]);

  const { data, isLoading, isFetching, error: queryError } = useGetDispatcherDealerQuery(dealerId, { skip: !dealerId });
  const dealer = data?.item || null;
  const loading = isLoading && !dealer;
  const error = queryError?.message || "";

  if (loading) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <Surface padding={20}>
          <div style={{ height: 100, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
        <Surface padding={20}>
          <div style={{ height: 180, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      </div>
    );
  }

  if (!dealer) {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        {error ? (
          <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        ) : null}
        <EmptyState icon="store" title="Dealer not found" subtitle="This dealer is not currently assigned to your dispatcher account." />
        <div>
          <GhostButton onClick={() => navigate("/dispatcher/dashboard/dealers")}>Back to Dealers</GhostButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <Surface padding={20} className="dash-fade-up">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar label={dealer.companyName || dealer.contactName || "D"} size={48} />
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--color-ink, #1d1d1f)" }}>
                {dealer.companyName || "Dealer Profile"}
              </div>
              <div style={{ marginTop: 3, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>
                {isFetching ? "Updating…" : dealer.contactName || dealer.email || "No contact on file"}
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <Pill tone={statusTone(dealer.status)} size="small">{dealer.status || "—"}</Pill>
                <Pill tone="accent" size="small">{dealer.fulfillmentMode || "DISPATCHER"}</Pill>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <GhostButton onClick={() => navigate("/dispatcher/dashboard/dealers")}>Back</GhostButton>
            <GhostButton icon="orders" onClick={() => navigate(`/dispatcher/dashboard/dealers/${dealerId}/orders`)}>
              View Orders
            </GhostButton>
          </div>
        </div>
      </Surface>

      {error ? (
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      ) : null}

      <Surface padding={22} className="dash-fade-up">
        <SectionHeader icon="user" title="Operational Identity" subtitle="Dealer details visible within your dispatcher scope." />
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 16 }}>
          <DetailItem label="Company Name" value={dealer.companyName} />
          <DetailItem label="Contact Name" value={dealer.contactName} />
          <DetailItem label="Email" value={dealer.email} />
          <DetailItem label="Phone" value={dealer.phone} />
          <DetailItem label="Address" value={dealer.address} />
          <DetailItem label="PAN / VAT" value={dealer.panVat} />
        </div>
      </Surface>
    </div>
  );
}
