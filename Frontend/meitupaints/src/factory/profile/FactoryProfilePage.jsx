import { useAuth } from "../../auth/AuthProvider.jsx";
import { Avatar, SectionHeader, Surface } from "../../components/dashboard/DashboardUI.jsx";
import { DetailGrid } from "../factoryUI.jsx";

export default function FactoryProfilePage() {
  const { user } = useAuth();

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface padding={22} className="dash-fade-up">
        <SectionHeader icon="user" title="Factory Operator" subtitle="Your account details for this Factory workspace." />
      </Surface>

      <Surface padding={22} className="dash-fade-up">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar label={user?.username || user?.email || "F"} size={52} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{user?.username || "Factory User"}</div>
            <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 500, color: "var(--color-graphite, #707070)" }}>{user?.email || "—"}</div>
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <DetailGrid
            rows={[
              ["Email", user?.email || "—"],
              ["Username", user?.username || "—"],
              ["Role", user?.role || "FACTORY"],
            ]}
          />
        </div>
      </Surface>
    </div>
  );
}
