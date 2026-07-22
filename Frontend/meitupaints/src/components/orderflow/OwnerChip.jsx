import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { getOwner } from "../../shared/orderStateMachine.js";

const ROLE_LABEL = { ADMIN: "Admin", DISPATCHER: "Dispatcher", FACTORY: "Factory" };
const CHIP_EASE = [0.23, 1, 0.32, 1]; // --ease-out-strong

// Every terminal status (COMPLETED, REJECTED, CANCELLED) already has its
// own StatusBadge/Pill wherever OwnerChip is used - getOwner returning null
// for all of them (see orderStateMachine.js) means there is nothing left
// for this chip to say that isn't a verbatim repeat of that badge (confirmed
// live: a rejected order rendered two "Rejected" pills side by side before
// this fix). OwnerChip's whole job is answering "who does this still need
// action from" - once that answer is "no one," it renders nothing rather
// than echo the status pill. Dispatcher-mode DISPATCHED used to be terminal
// too (owner: null) but isn't anymore - it's now a real owned stage, same
// as Factory's own "In transit", so getOwner correctly returns a role for
// it and this chip renders normally there.
function chipContent(order, role) {
  const owner = getOwner(order);
  if (!owner) return null;
  if (owner === role) return { text: "Waiting on you", tone: "azure" };
  return { text: `With ${ROLE_LABEL[owner] || owner}`, tone: "neutral" };
}

// One chip per card, top-right, before the status chip. The only azure
// allowed on a card is reserved for "this is on you" - everything else
// ("With Factory") stays quiet so "Waiting on you" actually
// pops when it matters (§2.3).
export function OwnerChip({ order, role }) {
  const content = chipContent(order, role);
  const shouldReduceMotion = useReducedMotion();

  return (
    <span className="orderflow-owner-chip">
      <AnimatePresence initial={false}>
        {content ? (
          <motion.span
            key={content.text}
            className={`orderflow-owner-chip-inner orderflow-owner-chip-${content.tone}`}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, filter: "blur(2px)" }}
            animate={{ opacity: 1, filter: "blur(0px)", position: "relative" }}
            exit={
              shouldReduceMotion
                ? { opacity: 0, position: "absolute" }
                : { opacity: 0, filter: "blur(2px)", position: "absolute" }
            }
            transition={{ duration: shouldReduceMotion ? 0.001 : 0.2, ease: CHIP_EASE }}
          >
            {content.text}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

export function OwnerChipStyles() {
  return (
    <style>{`
      .orderflow-owner-chip{
        position:relative;
        display:inline-flex;
        vertical-align:middle;
      }
      .orderflow-owner-chip-inner{
        top:0;
        left:0;
        display:inline-flex;
        align-items:center;
        white-space:nowrap;
        padding:3px 10px;
        border-radius:999px;
        font-size:11.5px;
        font-weight:600;
        letter-spacing:.01em;
      }
      .orderflow-owner-chip-azure{
        background:rgba(0,113,227,.1);
        color:var(--color-azure, #0071e3);
      }
      .orderflow-owner-chip-neutral{
        background:var(--color-fog, #f5f5f7);
        color:var(--color-graphite, #707070);
      }
      .orderflow-owner-chip-quiet{
        background:rgba(29,29,31,.05);
        color:var(--color-graphite, #707070);
        font-weight:500;
      }
      .orderflow-owner-chip-caution{
        background:rgba(182,68,0,.1);
        color:var(--color-caution, #b64400);
      }
    `}</style>
  );
}
