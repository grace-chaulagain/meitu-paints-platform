import { useMediaQuery } from "../../hooks/useMediaQuery.js";
import { ModalOverlay } from "../../factory/factoryUI.jsx";
import { MobileSheet } from "../../dealer/mobile/MobileSheet.jsx";
import { AppleSpinner } from "../../dealer/mobile/AppleSpinner.jsx";
import { OrderStatusRail } from "./OrderStatusRail.jsx";
import { ACTION_VERB, getConsequences, getHandoffLine } from "../../shared/orderStateMachine.js";

// §2.4. `action` + `target` come straight off the same getTransitions()
// entry the caller already has (target drives the rail preview - the
// caller doesn't need to compute anything extra). `onConfirm` follows the
// existing runAction/run convention already wired in Phase 0.2 (resolves
// to true on success, false on a handled failure) - on true this sheet
// closes itself; on false it stays open so the caller's own `error`
// (already flowing through handleTransitionError/GENERIC_ACTION_ERROR)
// stays visible right where the user is looking, instead of behind it.
export function TransitionConfirmSheet({ open, onClose, order, action, target, onConfirm, busy, error, children }) {
  const isMobile = useMediaQuery("(max-width: 768px)");

  if (!order || !action) return null;

  const consequences = getConsequences(order, action);
  const handoff = getHandoffLine(order, action);
  const verb = ACTION_VERB[action] || action;
  // Projecting the target status onto a copy of the order is enough for
  // getRailNodes to render the right preview: nodes before the target stay
  // correctly "done" (their real timestamps are already set), the target
  // node becomes "current" (or "done" if terminal), later nodes stay "todo".
  const previewOrder = target ? { ...order, status: target } : order;

  function safeClose() {
    if (!busy) onClose?.();
  }

  async function handleConfirm() {
    const success = await onConfirm?.();
    if (success) onClose?.();
  }

  const body = (
    <div className="orderflow-confirm">
      <div className="orderflow-confirm-rail">
        <OrderStatusRail order={previewOrder} size="lg" />
      </div>
      {children ? <div className="orderflow-confirm-fields">{children}</div> : null}
      {consequences.length ? (
        <ul className="orderflow-confirm-consequences">
          {consequences.map((line) => {
            const isWarning = line.startsWith("⚠");
            return (
              <li key={line} className={isWarning ? "orderflow-confirm-consequence-warn" : ""}>
                {isWarning ? <span className="orderflow-confirm-warn-glyph">⚠</span> : null}
                {line.replace(/^⚠\s*/, "")}
              </li>
            );
          })}
        </ul>
      ) : null}
      {handoff ? <div className="orderflow-confirm-handoff">{handoff}</div> : null}
      {error ? <div className="orderflow-confirm-error">{error}</div> : null}
      <div className="orderflow-confirm-actions">
        <button type="button" className="orderflow-confirm-cancel" onClick={safeClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="orderflow-confirm-btn" onClick={handleConfirm} disabled={busy}>
          <span className="orderflow-confirm-btn-label" style={{ opacity: busy ? 0 : 1 }}>
            {verb} {order.orderNumber}
          </span>
          {busy ? (
            <span className="orderflow-confirm-btn-spinner">
              <AppleSpinner size={16} color="#fff" />
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <MobileSheet open={open} onClose={safeClose} ariaLabel={`${verb} ${order.orderNumber}`} dragDisabled={busy}>
        {body}
      </MobileSheet>
    );
  }

  return (
    <ModalOverlay open={open} onClose={safeClose} maxWidth={560}>
      {body}
    </ModalOverlay>
  );
}

export function TransitionConfirmSheetStyles() {
  return (
    <style>{`
      .orderflow-confirm{ display:flex; flex-direction:column; gap:18px; }
      .orderflow-confirm-rail{
        padding:16px 4px 4px;
        border-bottom:1px solid rgba(29,29,31,.06);
        padding-bottom:18px;
      }
      .orderflow-confirm-fields{ display:flex; flex-direction:column; gap:12px; }

      .orderflow-confirm-consequences{
        list-style:none;
        margin:0;
        padding:0;
        display:flex;
        flex-direction:column;
        gap:8px;
      }
      .orderflow-confirm-consequences li{
        font-size:13.5px;
        color:var(--color-slate, #474747);
        line-height:1.45;
        padding-left:2px;
      }
      .orderflow-confirm-consequence-warn{
        color:var(--color-caution, #b64400);
        font-weight:600;
        display:flex;
        gap:6px;
        align-items:flex-start;
      }
      .orderflow-confirm-warn-glyph{ flex-shrink:0; }

      .orderflow-confirm-handoff{
        font-size:13px;
        font-weight:600;
        color:var(--color-graphite, #707070);
        background:var(--color-fog, #f5f5f7);
        border-radius:12px;
        padding:10px 12px;
      }

      .orderflow-confirm-error{
        font-size:13px;
        font-weight:600;
        color:#b42318;
        background:rgba(180,35,24,.08);
        border-radius:12px;
        padding:10px 12px;
      }

      .orderflow-confirm-actions{
        display:flex;
        gap:10px;
        justify-content:flex-end;
      }
      .orderflow-confirm-cancel{
        height:40px;
        padding:0 18px;
        border-radius:999px;
        border:1px solid rgba(29,29,31,.12);
        background:#fff;
        color:var(--color-ink, #1d1d1f);
        font-size:13.5px;
        font-weight:600;
        cursor:pointer;
        transition:transform 160ms var(--ease-out-strong, ease), background-color 160ms ease;
      }
      .orderflow-confirm-cancel:active{ transform:scale(.97); }
      .orderflow-confirm-cancel:disabled{ opacity:.5; cursor:default; }

      .orderflow-confirm-btn{
        position:relative;
        height:40px;
        padding:0 20px;
        border-radius:999px;
        border:none;
        background:var(--color-azure, #0071e3);
        color:#fff;
        font-size:13.5px;
        font-weight:700;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        transition:transform 160ms var(--ease-out-strong, ease), opacity 160ms ease;
      }
      .orderflow-confirm-btn:active:not(:disabled){ transform:scale(.97); }
      .orderflow-confirm-btn:disabled{ cursor:default; opacity:.85; }
      .orderflow-confirm-btn-label{ transition:opacity 140ms ease; white-space:nowrap; }
      .orderflow-confirm-btn-spinner{
        position:absolute;
        inset:0;
        display:grid;
        place-items:center;
      }

      @media (prefers-reduced-motion: reduce){
        .orderflow-confirm-cancel, .orderflow-confirm-btn{ transition:none; }
      }
    `}</style>
  );
}
