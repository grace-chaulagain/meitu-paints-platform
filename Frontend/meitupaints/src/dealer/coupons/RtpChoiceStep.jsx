import { ChoiceCard, StepHeader } from "./wizardUI.jsx";

export default function RtpChoiceStep({ onChooseRegister, onChooseCashOnly, onBack }) {
  return (
    <div>
      <StepHeader title="Register this painter?" onBack={onBack} />
      <p style={{ marginTop: -10, marginBottom: 14, fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
        Registering lets this painter accumulate points for annual bonuses and schemes.
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        <ChoiceCard
          icon="checkmark"
          tone="accent"
          title="Register this painter"
          subtitle="Search or add their profile to accumulate points"
          onClick={onChooseRegister}
        />
        <ChoiceCard
          icon="invoice"
          title="Cash only, no profile"
          subtitle="Redeem now — points are not accumulated"
          onClick={onChooseCashOnly}
        />
      </div>
    </div>
  );
}
