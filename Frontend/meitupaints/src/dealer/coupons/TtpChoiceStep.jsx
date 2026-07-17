import { ChoiceCard, StepHeader } from "./wizardUI.jsx";

export default function TtpChoiceStep({ onChooseLookup, onChooseCashOnly, onBack }) {
  return (
    <div>
      <StepHeader title="Do you have their Painter ID?" onBack={onBack} />
      <p style={{ marginTop: -10, marginBottom: 14, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
        Linking their Painter ID lets this redemption add points to their TTP account.
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        <ChoiceCard
          icon="checkmark"
          tone="accent"
          title="Look up Painter ID"
          subtitle="Search by the ID on their Golden License Card"
          onClick={onChooseLookup}
        />
        <ChoiceCard
          icon="invoice"
          title="Cash only, skip ID"
          subtitle="Redeem now — no points are added to any account"
          onClick={onChooseCashOnly}
        />
      </div>
    </div>
  );
}
