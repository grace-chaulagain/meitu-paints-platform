import { useAuth } from "../../auth/AuthProvider.jsx";
import { useGetMyDispatcherProfileQuery } from "../../redux/api/meituApi.js";

function GlassCard({ children, style = {} }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(15,23,42,.08)",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(15,23,42,.04)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="dispatcher-profile-detail">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

export default function DispatcherProfileWorkspacePage() {
  const { user } = useAuth();
  const {
    data: profile = null,
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useGetMyDispatcherProfileQuery();

  const loading = isLoading && !profile;
  const error = queryError?.message || "";

  const displayName =
    profile?.name || user?.name || user?.username || user?.email || "Dispatcher";

  return (
    <div className="dispatcher-profile-page">
      <GlassCard style={{ padding: 22 }}>
        <div className="dispatcher-profile-header">
          <div>
            <div className="dispatcher-profile-kicker">Dispatcher Profile</div>
            <h1>{displayName}</h1>
            <p>
              Operational identity and account context for the dispatcher
              workspace.
            </p>
          </div>
          <button type="button" onClick={refetch}>
            {isFetching && profile ? "Updating..." : "Refresh"}
          </button>
        </div>
        {error ? <div className="dispatcher-profile-error">{error}</div> : null}
      </GlassCard>

      {loading ? (
        <GlassCard style={{ padding: 18 }}>
          <div className="dispatcher-profile-skeleton" />
        </GlassCard>
      ) : (
        <GlassCard style={{ padding: 22 }}>
          <div className="dispatcher-profile-grid">
            <Detail label="Company" value={profile?.companyName} />
            <Detail label="Email" value={profile?.email || user?.email} />
            <Detail label="Phone" value={profile?.phone} />
            <Detail label="Status" value={profile?.status} />
            <Detail label="Active" value={profile?.isActive ? "Yes" : "No"} />
            <Detail label="Address" value={profile?.address} />
            <Detail label="Notes" value={profile?.notes} />
            <Detail
              label="Verified At"
              value={
                profile?.verifiedAt
                  ? new Date(profile.verifiedAt).toLocaleString()
                  : "—"
              }
            />
          </div>
        </GlassCard>
      )}

      <style>{`
        .dispatcher-profile-page{ display:grid; gap:18px; }
        .dispatcher-profile-header{ display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; }
        .dispatcher-profile-kicker{ font-size:12px; font-weight:950; letter-spacing:.1em; text-transform:uppercase; color:rgba(15,23,42,.46); }
        .dispatcher-profile-header h1{ margin:8px 0 0; color:#0f172a; font-size:30px; line-height:1.1; font-weight:950; letter-spacing:-.03em; }
        .dispatcher-profile-header p{ margin:8px 0 0; max-width:620px; color:rgba(15,23,42,.58); font-size:14px; line-height:1.65; font-weight:700; }
        .dispatcher-profile-header button{ min-height:40px; border-radius:14px; border:1px solid rgba(15,23,42,.08); background:#fff; color:#0f172a; padding:0 14px; font-weight:900; cursor:pointer; }
        .dispatcher-profile-error{ margin-top:14px; padding:13px 15px; border-radius:16px; background:rgba(180,35,24,.08); color:#b42318; border:1px solid rgba(180,35,24,.14); font-weight:800; }
        .dispatcher-profile-grid{ display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap:12px; }
        .dispatcher-profile-detail{ border-radius:18px; border:1px solid rgba(15,23,42,.06); background:rgba(248,250,252,.95); padding:15px; display:grid; gap:8px; min-width:0; }
        .dispatcher-profile-detail span{ font-size:11px; font-weight:950; letter-spacing:.08em; text-transform:uppercase; color:rgba(15,23,42,.44); }
        .dispatcher-profile-detail strong{ font-size:14px; line-height:1.55; font-weight:850; color:#0f172a; word-break:break-word; }
        .dispatcher-profile-skeleton{ height:180px; border-radius:18px; background:linear-gradient(90deg, rgba(241,245,249,.9), rgba(248,250,252,1), rgba(241,245,249,.9)); }
        @media (max-width:760px){
          .dispatcher-profile-page{ gap:14px; }
          .dispatcher-profile-header{ display:grid; align-items:start; }
          .dispatcher-profile-header h1{ font-size:clamp(24px, 8vw, 30px); overflow-wrap:anywhere; }
          .dispatcher-profile-header button{ width:100%; min-height:44px; }
          .dispatcher-profile-grid{ grid-template-columns:1fr; }
        }
        @media (max-width:420px){
          .dispatcher-profile-detail{ padding:13px; border-radius:16px; }
        }
      `}</style>
    </div>
  );
}
