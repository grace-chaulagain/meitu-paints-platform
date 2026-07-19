import { useLocation, useNavigate } from "react-router-dom";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { formatMoney } from "../pricing.js";
import { useOrderDraft } from "./useOrderDraft.js";

// The "you have an order in progress" anchor - docks above the tab bar
// whenever the draft has >=1 item, persists across Home/Browse/product
// screens (rendered once from DealerDashboardPage.jsx, not per-page).
//
// Always mounted, even at itemCount 0 - visibility is a CSS transition
// (opacity/transform via a `.visible` class), never a DOM mount/unmount.
// Live-commit quantity edits mean itemCount crosses the 0/1 boundary often
// (tapping - down to zero, then + again); unmounting on every crossing
// recreated the button node each time, which replayed the entrance
// keyframe AND the old added-item pulse on top of it - the "pops and loads
// again" jitter. A transition just retargets smoothly no matter how often
// it's interrupted, so there's no separate pulse effect to layer either.
//
// `inline` renders the same pill in normal document flow instead of
// position:fixed - used by ProductSheet to put it exactly where the old
// "Add to order" button used to sit (its own footer, self-hides until the
// draft actually has something in it). `onBeforeNavigate` lets that caller
// close its own sheet before the route change.
export function CartPill({ hidden = false, inline = false, onBeforeNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { itemCount, subtotal } = useOrderDraft();

  const shouldShow = !hidden && itemCount > 0 && (inline || location.pathname !== "/dealer/cart");

  function handleClick() {
    onBeforeNavigate?.();
    navigate("/dealer/cart");
  }

  return (
    <button
      type="button"
      className={`dealer-m-cart-pill ${inline ? "dealer-m-cart-pill-inline" : ""} ${shouldShow ? "visible" : ""}`}
      onClick={handleClick}
      aria-hidden={!shouldShow}
      tabIndex={shouldShow ? 0 : -1}
    >
      <span className="dealer-m-cart-pill-row">
        <span className="dealer-m-cart-pill-side">
          <DashboardIcon name="cart" size={16} strokeWidth={1.9} />
        </span>
        {/* V3 §5.4: rolling total - keying by the text itself forces a
            fresh node on every change, which is what lets a pure-CSS
            mount keyframe play the blur-crossfade instead of the number
            hard-swapping. */}
        <span key={`${itemCount}-${subtotal}`} className="dealer-m-cart-pill-text dealer-m-cart-pill-text-roll">
          {itemCount} item{itemCount === 1 ? "" : "s"} &middot; {formatMoney(subtotal)}
        </span>
        <span className="dealer-m-cart-pill-side">
          <DashboardIcon name="chevron" size={13} strokeWidth={2.3} />
        </span>
      </span>
    </button>
  );
}
