import { useState } from "react";
import { DashboardIcon } from "../dashboard/DashboardIcons.jsx";
import { isSoundMuted, setSoundMuted } from "./arrivals.js";

// Small speaker icon in each portal header (§2.6) - one shared localStorage
// key means muting in Admin also mutes Factory/Dispatcher, matching "this
// is one operator's preference," not a per-portal setting.
export function SoundMuteToggle() {
  const [muted, setMuted] = useState(() => isSoundMuted());

  function toggle() {
    const next = !muted;
    setSoundMuted(next);
    setMuted(next);
  }

  return (
    <button
      type="button"
      className="orderflow-mute-toggle"
      onClick={toggle}
      aria-label={muted ? "Unmute arrival sounds" : "Mute arrival sounds"}
      title={muted ? "Arrival sounds muted" : "Arrival sounds on"}
    >
      <DashboardIcon name={muted ? "volumeMuted" : "volume"} size={16} strokeWidth={1.9} />
    </button>
  );
}

// Azure "New" dot for cards newer than the lane's seen-stamp.
export function NewDot() {
  return <span className="orderflow-new-dot" aria-label="New" title="New since you last looked" />;
}

export function ArrivalStyles() {
  return (
    <style>{`
      .orderflow-mute-toggle{
        width:32px;
        height:32px;
        border-radius:999px;
        border:1px solid rgba(29,29,31,.1);
        background:#fff;
        color:var(--color-graphite, #707070);
        display:grid;
        place-items:center;
        cursor:pointer;
        transition:transform 140ms var(--ease-out-strong, ease), color 140ms ease, border-color 140ms ease;
      }
      .orderflow-mute-toggle:hover{ color:var(--color-ink, #1d1d1f); border-color:rgba(29,29,31,.18); }
      .orderflow-mute-toggle:active{ transform:scale(.94); }

      .orderflow-new-dot{
        display:inline-block;
        width:7px;
        height:7px;
        border-radius:999px;
        background:var(--color-azure, #0071e3);
        flex-shrink:0;
      }

      /* Applied to a card for its arrival window (~2.2s): azure-at-6%
         background decaying to transparent + an 8px slide-in. Caller
         toggles this class on/off using useQueueArrivals()'s returned id
         set - drop it the moment a card's id is no longer in that set. */
      .orderflow-arrival-highlight{
        animation:orderflowArrivalIn 2000ms var(--ease-out-strong, ease) forwards;
      }
      @keyframes orderflowArrivalIn{
        0%{ background-color:rgba(0,113,227,.06); transform:translateY(-8px); opacity:.85; }
        15%{ transform:translateY(0); opacity:1; }
        100%{ background-color:rgba(0,113,227,0); transform:translateY(0); opacity:1; }
      }

      @media (prefers-reduced-motion: reduce){
        .orderflow-mute-toggle{ transition:none; }
        .orderflow-arrival-highlight{ animation:orderflowArrivalFadeOnly 600ms ease forwards; }
      }
      @keyframes orderflowArrivalFadeOnly{
        0%{ background-color:rgba(0,113,227,.06); }
        100%{ background-color:rgba(0,113,227,0); }
      }
    `}</style>
  );
}
