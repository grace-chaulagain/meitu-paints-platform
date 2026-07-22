const ACTION_PAST_TENSE = {
  verify: "Verified",
  reject: "Rejected",
  dispatch: "Dispatched",
  deliver: "Delivered",
  "confirm-handover": "Handover confirmed",
  "revert-verification": "Verification undone",
};

// Small presentational piece most callers can drop straight onto a card;
// callers with a very different card layout are free to read `celebration`
// off useOrderTransition directly and render their own markup instead. Kept
// in its own file (not alongside the useOrderTransition hook) so this
// module only exports components - a file mixing a hook export with
// component exports breaks React Fast Refresh boundaries.
export function CelebrationLine({ celebration, onUndo, holdOpen, resumeCountdown }) {
  if (!celebration) return null;
  const label = ACTION_PAST_TENSE[celebration.action] || "Updated";
  return (
    <div
      className="orderflow-celebrate-line"
      onMouseEnter={holdOpen}
      onMouseLeave={() => resumeCountdown()}
      onFocus={holdOpen}
      onBlur={() => resumeCountdown()}
    >
      <span className="orderflow-celebrate-text">{label} · just now</span>
      {celebration.canUndo ? (
        <button type="button" className="orderflow-celebrate-undo" onClick={onUndo}>
          Undo
        </button>
      ) : null}
    </div>
  );
}

export function OrderTransitionStyles() {
  return (
    <style>{`
      .orderflow-celebrate-line{
        display:flex;
        align-items:center;
        gap:10px;
        font-size:12.5px;
        font-weight:600;
        color:var(--color-azure, #0071e3);
        animation:orderflowCelebrateIn 220ms var(--ease-out-strong, cubic-bezier(.23,1,.32,1)) both;
      }
      @keyframes orderflowCelebrateIn{
        0%{ opacity:0; transform:translateX(-4px); }
        100%{ opacity:1; transform:translateX(0); }
      }

      .orderflow-celebrate-undo{
        border:none;
        background:rgba(0,113,227,.1);
        color:var(--color-azure, #0071e3);
        border-radius:999px;
        padding:3px 11px;
        font-size:11.5px;
        font-weight:700;
        cursor:pointer;
        transition:transform 140ms var(--ease-out-strong, ease), background-color 140ms ease;
      }
      .orderflow-celebrate-undo:active{ transform:scale(.95); }

      .orderflow-card-exit-left, .orderflow-card-exit-right, .orderflow-card-exit-up{
        transition:transform 300ms var(--ease-in-out-strong, ease), opacity 300ms var(--ease-in-out-strong, ease);
        pointer-events:none;
      }
      .orderflow-card-exit-left{ transform:translateX(-110%); opacity:0; }
      .orderflow-card-exit-right{ transform:translateX(110%); opacity:0; }
      .orderflow-card-exit-up{ transform:translateY(-24px); opacity:0; }

      @media (prefers-reduced-motion: reduce){
        .orderflow-celebrate-line{ animation:none; opacity:1; }
        .orderflow-card-exit-left, .orderflow-card-exit-right, .orderflow-card-exit-up{
          transition:opacity 120ms ease;
          transform:none;
        }
      }
    `}</style>
  );
}
