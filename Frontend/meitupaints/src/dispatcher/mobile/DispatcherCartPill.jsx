import { useLocation, useNavigate } from "react-router-dom";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { useDispatcherOrderDraft } from "./useDispatcherOrderDraft.js";

function money(value) {
  return `NPR ${Number(value || 0).toLocaleString()}`;
}

// Mirrors src/dealer/mobile/CartPill.jsx exactly - the "you have an order
// in progress" floating anchor, rendered once from DispatcherShopPage.jsx.
// `inline` renders the same pill in normal flow (used by
// DispatcherProductSheet in place of its own footer button).
export function DispatcherCartPill({ hidden = false, inline = false, onBeforeNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { itemCount, subtotal } = useDispatcherOrderDraft();

  const shouldShow = !hidden && itemCount > 0 && (inline || location.pathname !== "/dispatcher/cart");

  function handleClick() {
    onBeforeNavigate?.();
    navigate("/dispatcher/cart");
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
        <span key={`${itemCount}-${subtotal}`} className="dealer-m-cart-pill-text dealer-m-cart-pill-text-roll">
          {itemCount} item{itemCount === 1 ? "" : "s"} &middot; {money(subtotal)}
        </span>
        <span className="dealer-m-cart-pill-side">
          <DashboardIcon name="chevron" size={13} strokeWidth={2.3} />
        </span>
      </span>
    </button>
  );
}
