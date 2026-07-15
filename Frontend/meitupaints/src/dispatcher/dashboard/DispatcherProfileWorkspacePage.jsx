import { useAuth } from "../../auth/AuthProvider.jsx";
import { useGetMyDispatcherProfileQuery } from "../../redux/api/meituApi.js";
import { DashboardUIStyles, GhostButton, Pill, SectionHeader, Surface } from "../../components/dashboard/DashboardUI.jsx";

function statusTone(status) {
  if (status === "VERIFIED") return "positive";
  if (status === "REJECTED") return "critical";
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

export default function DispatcherProfileWorkspacePage() {
  const { user } = useAuth();
  const { data: profile = null, isLoading, isFetching, error: queryError, refetch } = useGetMyDispatcherProfileQuery();

  const loading = isLoading && !profile;
  const error = queryError?.message || "";
  const displayName = profile?.name || user?.name || user?.username || user?.email || "Dispatcher";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />

      <Surface padding={22} className="dash-fade-up">
        <SectionHeader
          eyebrow="Dispatcher Profile"
          icon="user"
          title={displayName}
          subtitle="Operational identity and account context."
          action={
            <GhostButton icon="refresh" onClick={refetch}>
              {isFetching && profile ? "Updating…" : "Refresh"}
            </GhostButton>
          }
        />

        {profile ? (
          <div style={{ marginTop: 14 }}>
            <Pill tone={statusTone(profile.status)} size="small">
              {profile.status || "—"}
            </Pill>
          </div>
        ) : null}

        {error ? (
          <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(180,35,24,.08)", color: "#b42318", fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
        ) : null}
      </Surface>

      {loading ? (
        <Surface padding={18}>
          <div style={{ height: 160, borderRadius: 14, background: "linear-gradient(90deg, rgba(0,0,0,.04), rgba(0,0,0,.02), rgba(0,0,0,.04))" }} />
        </Surface>
      ) : (
        <Surface padding={22} className="dash-fade-up">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 16 }}>
            <DetailItem label="Company" value={profile?.companyName} />
            <DetailItem label="Email" value={profile?.email || user?.email} />
            <DetailItem label="Phone" value={profile?.phone} />
            <DetailItem label="Active" value={profile?.isActive ? "Yes" : "No"} />
            <DetailItem label="Address" value={profile?.address} />
            <DetailItem label="Notes" value={profile?.notes} />
            <DetailItem label="Verified At" value={profile?.verifiedAt ? new Date(profile.verifiedAt).toLocaleString() : "—"} />
          </div>
        </Surface>
      )}
    </div>
  );
}
