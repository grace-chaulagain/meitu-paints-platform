import { ChoiceCard, StepHeader } from "./wizardUI.jsx";

export default function PainterTypeStep({ onSelectType, onBack, couponType }) {
  const isGolden = couponType === "GOLDEN";

  return (
    <div>
      <StepHeader title="Who is this for?" onBack={onBack} />
      <div style={{ display: "grid", gap: 10 }}>
        <ChoiceCard
          icon="checkmark"
          tone="accent"
          title="TTP — Texture Trained Painter"
          subtitle="Has a Meitu Golden License Card"
          onClick={() => onSelectType("TTP")}
        />
        <ChoiceCard
          icon="user"
          title="RTP — Regular Trained Painter"
          subtitle={
            isGolden
              ? "Regular wall paint, no license card — cash only, no points recorded"
              : "Regular wall paint, no license card"
          }
          onClick={() => onSelectType("RTP")}
        />
      </div>
    </div>
  );
}
