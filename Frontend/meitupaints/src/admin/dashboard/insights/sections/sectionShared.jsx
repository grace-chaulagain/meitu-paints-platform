import { SectionHeader } from "../../../../components/dashboard/DashboardUI.jsx";

// Shared by every account-keeping section (Cash Position, Dealer
// Statements & AR, Payment Reconciliation, and the Phase 3 sections that
// follow) - factored out once three sibling files needed the identical
// layout primitives, rather than duplicated per file. Plain constants/
// style helpers live in sectionLayout.js instead of here so this file only
// exports components (react-refresh/only-export-components).

export function PanelHead({ eyebrow, icon, title, action }) {
  return (
    <div style={{ padding: "18px 18px 4px" }}>
      <SectionHeader eyebrow={eyebrow} icon={icon} title={title} size="small" action={action} />
    </div>
  );
}

export function ErrorBanner({ message }) {
  return (
    <div
      style={{
        padding: "13px 15px",
        borderRadius: 14,
        background: "rgba(180,35,24,.08)",
        color: "#b42318",
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {message}
    </div>
  );
}
