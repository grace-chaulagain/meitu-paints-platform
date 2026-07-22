import { useEffect, useRef, useState } from "react";
import { getRailNodes } from "../../shared/orderStateMachine.js";
import { DashboardIcon } from "../dashboard/DashboardIcons.jsx";

// "Jul 21, 2:14 PM" - deliberately no year (rail metadata is always about
// recent operational events, never historical lookups) and kept local
// rather than importing a portal's own formatter, since this component is
// shared across all three ops portals.
function shortDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const ROLE_LABEL = { ADMIN: "Admin", DISPATCHER: "Dispatcher", FACTORY: "Factory" };

function nodeMeta(node) {
  const parts = [node.label];
  if (node.byRole && ROLE_LABEL[node.byRole]) parts.push(ROLE_LABEL[node.byRole]);
  const when = shortDateTime(node.at);
  if (when) parts.push(when);
  return parts.join(" · ");
}

function railTitle(nodes) {
  const active = nodes.find((n) => n.state === "current") || nodes[nodes.length - 1];
  return active ? nodeMeta(active) : "";
}

// `done` always gets a checkmark; `current` gets one too UNLESS the node is
// flagged inProgress (only "In transit" - a checkmark there would claim a
// delivery that hasn't happened). Every other "current" node (Submitted,
// Verified) represents a completed action merely awaiting the next party,
// so it reads as unfinished/empty if left blank the instant it's reached.
// Wrapped in its own pop-in span so the icon visibly arrives (scale+opacity)
// instead of snapping into existence the moment it mounts.
function NodeIcon({ node }) {
  if (node.state === "terminated") {
    return (
      <span className="orderflow-rail-icon-pop">
        <DashboardIcon name="close" size={10} strokeWidth={2.8} />
      </span>
    );
  }
  const showCheck = node.state === "done" || (node.state === "current" && !node.inProgress);
  if (!showCheck) return null;
  return (
    <span className="orderflow-rail-icon-pop">
      <DashboardIcon name="checkmark" size={11} strokeWidth={2.8} />
    </span>
  );
}

export function OrderStatusRail({ order, size = "sm", interactive = false, onClick }) {
  const nodes = getRailNodes(order);
  const [revealed, setRevealed] = useState(false);
  const mountedOnce = useRef(false);

  useEffect(() => {
    if (mountedOnce.current) return undefined;
    mountedOnce.current = true;
    const raf = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Momentary "just happened" confirmation pulse (§2.5's intended
  // rail-advance morph) - the color/opacity CSS transitions on the dot and
  // line already animate on their own the instant `order` changes, but a
  // pure color fade under-signals a status actually having changed, so this
  // adds a deliberate scale pulse on exactly the node(s) that moved. First
  // capture is a baseline, not a change (matches useQueueArrivals' pattern) -
  // a fresh page load shouldn't pulse every already-reached node.
  const prevStatesRef = useRef(null);
  const [justChangedKeys, setJustChangedKeys] = useState(() => new Set());
  const stateSignature = nodes.map((n) => `${n.key}:${n.state}`).join("|");

  useEffect(() => {
    const current = {};
    for (const n of nodes) current[n.key] = n.state;

    if (prevStatesRef.current === null) {
      prevStatesRef.current = current;
      return undefined;
    }

    const changed = new Set();
    for (const n of nodes) {
      if (prevStatesRef.current[n.key] !== n.state && n.state !== "todo") changed.add(n.key);
    }
    prevStatesRef.current = current;
    if (changed.size === 0) return undefined;

    setJustChangedKeys(changed);
    const timer = setTimeout(() => setJustChangedKeys(new Set()), 280);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateSignature]);

  const isLg = size === "lg";
  const Wrapper = interactive ? "button" : "div";
  const wrapperProps = interactive
    ? { type: "button", onClick, className: "orderflow-rail-interactive" }
    : {};

  // Every current call site already guards against a missing order
  // upstream (a loading/error state before the detail query resolves), so
  // this is defense-in-depth, not a live fix - but this component is
  // shared across three portals with independent call sites, and without
  // it a bare `order=undefined` would fall through getRailNodes'
  // default-to-"delivered" branch and render a nonsensical all-done rail
  // rather than nothing. Placed after every hook above so it never
  // violates the rules of hooks.
  if (!order) return null;

  return (
    <Wrapper
      className={`orderflow-rail orderflow-rail-${size}`}
      title={!isLg ? railTitle(nodes) : undefined}
      {...wrapperProps}
    >
      {nodes.map((node, index) => {
        const isFirst = index === 0;
        const isLast = index === nodes.length - 1;
        const nextNode = nodes[index + 1];
        const leftFilled = node.state !== "todo";
        const rightFilled = Boolean(nextNode) && nextNode.state !== "todo";
        return (
          <div className="orderflow-rail-node" key={node.key}>
            <div className="orderflow-rail-node-row">
              <span
                className={`orderflow-rail-line-half orderflow-rail-line-${leftFilled ? "filled" : "todo"}${isFirst ? " orderflow-rail-line-hidden" : ""}`}
                style={{ transitionDelay: revealed ? "0ms" : `${index * 150}ms` }}
                data-revealed={leftFilled && revealed ? "true" : "false"}
                aria-hidden="true"
              />
              <span
                className={`orderflow-rail-dot orderflow-rail-dot-${node.state} ${justChangedKeys.has(node.key) ? "orderflow-badge-pulse" : ""}`}
                style={{ transitionDelay: revealed ? "0ms" : `${index * 150}ms` }}
              >
                <NodeIcon node={node} />
              </span>
              <span
                className={`orderflow-rail-line-half orderflow-rail-line-${rightFilled ? "filled" : "todo"}${isLast ? " orderflow-rail-line-hidden" : ""}`}
                style={{ transitionDelay: revealed ? "0ms" : `${(index + 1) * 150}ms` }}
                data-revealed={rightFilled && revealed ? "true" : "false"}
                aria-hidden="true"
              />
            </div>
            {isLg ? (
              <div className="orderflow-rail-label-col">
                <div className={`orderflow-rail-label orderflow-rail-label-${node.state}`}>{node.label}</div>
                <div className="orderflow-rail-sub">
                  {node.state === "todo" ? "" : nodeMeta(node).replace(`${node.label} · `, "")}
                  {node.state === "terminated" && node.reason ? (
                    <span className="orderflow-rail-reason"> — {node.reason}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </Wrapper>
  );
}

export function OrderFlowRailStyles() {
  return (
    <style>{`
      .orderflow-rail{
        display:flex;
        align-items:flex-start;
        border:none;
        background:none;
        padding:0;
        margin:0;
        text-align:left;
        font:inherit;
        color:inherit;
      }
      .orderflow-rail-interactive{ cursor:pointer; }
      .orderflow-rail-sm{ align-items:center; }

      .orderflow-rail-node{
        display:flex;
        flex-direction:column;
        align-items:center;
        flex:1 1 0;
        min-width:0;
      }

      /* Each node gets an equal share of the rail's width (all nodes,
         including the first/last - a shrink-to-content last node was what
         crushed the final gap and threw the last two dots out of rhythm
         with the rest). The dot sits in a row between two half-lines, so
         it lands dead-center in the node's own width no matter how many
         nodes there are; the outer half of the first/last node's row is
         kept in-layout but invisible (not removed) so removing it can't
         shift the dot off-center. The label (lg only) sits below in the
         same column, also centered, so it always lines up under its dot -
         a side-by-side layout previously let a wide label overlap a
         neighbor's line+dot and threw the whole row out of alignment. */
      .orderflow-rail-node-row{
        display:flex;
        align-items:center;
        width:100%;
      }

      .orderflow-rail-line-half{
        height:2px;
        flex:1 1 auto;
        min-width:6px;
        background:rgba(29,29,31,.1);
        transition:background-color 300ms var(--ease-in-out-strong, ease);
      }
      .orderflow-rail-sm .orderflow-rail-line-half{ height:1.5px; min-width:4px; }
      .orderflow-rail-line-hidden{ visibility:hidden; }
      .orderflow-rail-line-filled{ background:rgba(29,29,31,.1); }
      .orderflow-rail-line-filled[data-revealed="true"]{
        background:var(--color-azure, #0071e3);
      }
      .orderflow-rail-line-todo{ background:rgba(29,29,31,.08); }

      .orderflow-rail-dot{
        flex-shrink:0;
        width:28px;
        height:28px;
        border-radius:999px;
        display:grid;
        place-items:center;
        background:rgba(29,29,31,.06);
        color:transparent;
        transition:background-color 260ms var(--ease-out-strong, ease), color 260ms var(--ease-out-strong, ease), box-shadow 260ms ease;
      }
      .orderflow-rail-sm .orderflow-rail-dot{ width:10px; height:10px; }

      .orderflow-rail-dot-done{ background:var(--color-azure, #0071e3); color:#fff; }
      .orderflow-rail-dot-current{
        background:var(--color-azure, #0071e3);
        color:#fff;
        animation:orderflowRailPulse 2s ease-in-out infinite;
      }
      .orderflow-rail-dot-todo{ background:rgba(29,29,31,.08); }
      .orderflow-rail-dot-terminated{ background:var(--color-caution, #b64400); color:#fff; }

      @keyframes orderflowRailPulse{
        0%, 100% { opacity:1; }
        50% { opacity:.55; }
      }

      /* One-shot "this just changed" confirmation - fired by OrderStatusRail
         whenever a node's state genuinely transitions while mounted (not on
         initial load). Lives here (not CelebrationLine's styles) because the
         rail renders on every list/archive row too, which never mount the
         detail page's OrderTransitionStyles. */
      .orderflow-badge-pulse{ animation:orderflowBadgePulse 280ms var(--ease-out-strong, cubic-bezier(.23,1,.32,1)); }
      @keyframes orderflowBadgePulse{
        0%{ transform:scale(1); }
        45%{ transform:scale(1.16); }
        100%{ transform:scale(1); }
      }

      /* Checkmark/close glyph pop-in (§ animation pass) - plays automatically
         the instant the icon is first inserted (state goes todo/in-progress
         -> done/verified), since CSS animations always run from their own 0%
         on mount. Never starts from scale(0) - a barely-visible starting
         scale reads as "arriving," not "created from nothing." */
      .orderflow-rail-icon-pop{
        display:grid;
        place-items:center;
        animation:orderflowIconPop 260ms var(--ease-out-strong, cubic-bezier(.23,1,.32,1)) both;
      }
      @keyframes orderflowIconPop{
        0%{ transform:scale(.4); opacity:0; }
        60%{ transform:scale(1.18); opacity:1; }
        100%{ transform:scale(1); opacity:1; }
      }

      .orderflow-rail-label-col{ margin-top:8px; padding:0 4px; min-width:0; max-width:100%; text-align:center; }
      .orderflow-rail-label{
        font-size:13px;
        font-weight:600;
        color:var(--color-ink, #1d1d1f);
        overflow-wrap:break-word;
      }
      .orderflow-rail-label-todo{ color:var(--color-graphite, #707070); font-weight:500; }
      .orderflow-rail-label-terminated{ color:var(--color-caution, #b64400); }
      .orderflow-rail-sub{
        margin-top:2px;
        font-size:12px;
        color:var(--color-graphite, #707070);
        line-height:1.4;
        overflow-wrap:break-word;
      }
      .orderflow-rail-reason{ color:var(--color-caution, #b64400); font-weight:500; }

      @media (prefers-reduced-motion: reduce){
        .orderflow-rail-dot-current{
          animation:none;
          box-shadow:0 0 0 3px rgba(0,113,227,.22);
        }
        .orderflow-rail-line-half, .orderflow-rail-dot{ transition:none; }
        .orderflow-badge-pulse{ animation:none; }
        .orderflow-rail-icon-pop{ animation:none; }
      }

      /* A 4-node lg rail in ~340px of usable width (390px viewport minus
         card padding) leaves each node ~70-85px - "Submitted"/"Delivered"
         etc. need a smaller face here than they do on desktop to read as
         one line instead of an awkward mid-word break. */
      @media (max-width:480px){
        .orderflow-rail-lg .orderflow-rail-dot{ width:22px; height:22px; }
        .orderflow-rail-lg .orderflow-rail-label{ font-size:11.5px; }
        .orderflow-rail-lg .orderflow-rail-sub{ font-size:10.5px; }
      }
    `}</style>
  );
}
