import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  useCreateSchemeOrderMutation,
  useUpdateSchemeOrderMutation,
  useDeleteSchemeOrderMutation,
  useGetSchemeRecipientsQuery,
  useGetProductsQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { Spinner } from "../../../components/dashboard/DashboardUI.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import { rankByLooseSearch } from "../../../utils/searchMatch.js";

// A scheme always ships from the factory, but who the admin is picking decides
// which group they sit in. `chip` labels a search result; `title` describes the
// recipient once one is chosen.
const SCOPES = [
  { key: "FACTORY_DEALERS", chip: "Factory", title: "Dealer · ships from the factory" },
  { key: "DISPATCHER_DEALERS", chip: "Via dispatcher", title: "Dealer · served by a dispatcher" },
  { key: "DISPATCHERS", chip: "Dispatcher", title: "Dispatcher" },
];

function scopeOf(recipient) {
  return SCOPES.find((scope) => matchesScope(recipient, scope.key));
}

const NOTE_MAX = 500;
const LABEL_MAX = 120;
// Exit is deliberately quicker than enter: slow where the system is
// presenting, fast where the user has already decided.
const CLOSE_MS = 150;
const LEAVE_MS = 170;

function matchesScope(recipient, scope) {
  if (scope === "DISPATCHERS") return recipient.recipientType === "DISPATCHER";
  if (scope === "FACTORY_DEALERS") {
    return recipient.recipientType === "DEALER" && recipient.servedBy !== "Dispatcher-served";
  }
  if (scope === "DISPATCHER_DEALERS") {
    return recipient.recipientType === "DEALER" && recipient.servedBy === "Dispatcher-served";
  }
  return false;
}

// Lines already on the scheme carry `available: null` - "the server decides".
// Their own units are counted inside every product's reservedQuantity, so the
// usual current-minus-reserved figure would show the scheme competing with
// itself and flag an unchanged quantity as over capacity. The server does the
// correct delta-based check (and, unlike this one, expands kits into their
// components), so its answer is authoritative and its message is surfaced
// inline. Newly added lines still get a real number - those aren't reserved
// yet, so the ordinary calculation is right for them.
function linesFromOrder(order) {
  if (!order) return [];
  return (order.items || []).map((item) => ({
    productId: String(item.productId?._id || item.productId || ""),
    name: item.name || item.sku || "Product",
    // packSnapshot is the fallback only for schemes raised before the field
    // name was corrected - those rows have neither, and simply show no size.
    packLabel: item.packLabel || item.packSnapshot || "",
    available: null,
    quantity: Number(item.quantity || 1),
  }));
}

const availableOf = (p) => Math.max(0, Number(p.stock?.currentQuantity || 0) - Number(p.stock?.reservedQuantity || 0));

// Pass `editOrder` to amend an existing scheme instead of raising a new one.
// The recipient is fixed once a scheme exists - pointing a grant at a
// different dealer is a different decision, and the server rejects it - so in
// edit mode the picker collapses to a read-only row.
export default function CreateSchemeOrderModal({ open, onClose, onCreated, editOrder = null }) {
  const isEdit = Boolean(editOrder);
  const recipientsQuery = useGetSchemeRecipientsQuery(undefined, { skip: !open || isEdit });
  const [createScheme, createState] = useCreateSchemeOrderMutation();
  const [updateScheme, updateState] = useUpdateSchemeOrderMutation();
  const [deleteScheme, deleteState] = useDeleteSchemeOrderMutation();

  const [recipientKey, setRecipientKey] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  // Seeded from the order rather than synced to it in an effect: the caller
  // mounts this fresh per scheme (keyed on the order id), so the initial
  // value IS the edit state and there's nothing to keep in sync afterwards.
  const [label, setLabel] = useState(() => editOrder?.scheme?.label || "");
  const [note, setNote] = useState(() => editOrder?.scheme?.note || editOrder?.dealerNote || "");
  const [lines, setLines] = useState(() => linesFromOrder(editOrder));
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [shortfalls, setShortfalls] = useState([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [closing, setClosing] = useState(false);

  const cardRef = useRef(null);
  const timersRef = useRef([]);

  const busy = createState.isLoading || updateState.isLoading || deleteState.isLoading;

  const trimmed = query.trim();
  const productsQuery = useGetProductsQuery({ q: trimmed }, { skip: !open || trimmed.length < 2 });
  const results = (productsQuery.data || []).slice(0, 6);

  const recipients = useMemo(() => recipientsQuery.data || [], [recipientsQuery.data]);
  // The picker is the search box and nothing else: results appear as you type
  // and disappear when the box is empty. A standing list of every dealer was
  // just a wall to scroll past on the way to the one name the admin already
  // had in mind.
  const isSearching = Boolean(recipientQuery.trim());
  const visibleRecipients = useMemo(
    () =>
      isSearching
        ? rankByLooseSearch(recipients, recipientQuery, (r) => [r.name, r.contactName, scopeOf(r)?.chip])
        : [],
    [recipients, recipientQuery, isSearching],
  );

  const selectedRecipient = recipients.find((r) => r.key === recipientKey) || null;
  const [recipientType, recipientId] = recipientKey ? recipientKey.split(":") : ["", ""];

  // Lines mid-removal stay in state just long enough to animate out, but
  // must not count toward anything the admin is about to submit.
  const liveLines = lines.filter((l) => !l.leaving);
  const totalUnits = liveLines.reduce((sum, l) => sum + Number(l.quantity || 0), 0);
  // `available: null` means unknown-and-server-checked, so it can't be over.
  const isOver = (l) => l.available !== null && Number(l.quantity) > l.available;
  const overCapacity = liveLines.some(isOver);
  const hasRecipient = isEdit || Boolean(recipientId);
  const canSubmit = hasRecipient && liveLines.length > 0 && !overCapacity;

  const requestClose = useCallback(() => {
    if (busy || closing) return;
    setClosing(true);
    timersRef.current.push(window.setTimeout(onClose, CLOSE_MS));
  }, [busy, closing, onClose]);

  useEffect(() => {
    // The page behind must not scroll while the dialog is open.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cardRef.current?.focus();
    const timers = timersRef.current;
    return () => {
      document.body.style.overflow = previous;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  function pickRecipient(recipient) {
    setRecipientKey(recipient.key);
    setRecipientQuery("");
  }

  function addProduct(product) {
    setLines((current) =>
      current.some((l) => l.productId === String(product._id))
        ? current
        : [
            ...current,
            {
              productId: String(product._id),
              name: product.name,
              packLabel: product.pack?.label || "",
              available: availableOf(product),
              quantity: 1,
            },
          ],
    );
    setQuery("");
  }

  function updateLine(productId, patch) {
    setLines((current) => current.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  }

  function removeLine(productId) {
    updateLine(productId, { leaving: true });
    timersRef.current.push(
      window.setTimeout(() => setLines((current) => current.filter((l) => l.productId !== productId)), LEAVE_MS),
    );
  }

  function stepQuantity(line, delta) {
    updateLine(line.productId, { quantity: Math.max(1, Number(line.quantity || 0) + delta) });
  }

  // Free typing while editing (so "" and half-typed numbers are allowed),
  // snapped to a real quantity the moment the field loses focus.
  function commitQuantity(line) {
    const value = Math.floor(Number(line.quantity));
    updateLine(line.productId, { quantity: Number.isFinite(value) && value >= 1 ? value : 1 });
  }

  function handleError(err, fallback) {
    const details = err?.data?.details;
    if (details?.code === "SCHEME_STOCK_SHORTFALL") {
      setShortfalls(details.shortfalls || []);
      setError("Stock moved while you were editing:");
    } else {
      setError(getQueryErrorMessage(err, fallback));
    }
  }

  async function handleSubmit() {
    setError("");
    setShortfalls([]);
    const items = liveLines.map((l) => ({ productId: l.productId, quantity: Math.max(1, Math.floor(Number(l.quantity)) || 1) }));
    try {
      if (isEdit) {
        await updateScheme({ orderId: editOrder._id, label: label.trim(), note: note.trim(), items }).unwrap();
      } else {
        await createScheme({ recipientType, recipientId, label: label.trim(), note: note.trim(), items }).unwrap();
      }
      onCreated?.(isEdit ? "updated" : "created");
      requestClose();
    } catch (err) {
      handleError(err, isEdit ? "Couldn't save the changes." : "Couldn't create the scheme order.");
    }
  }

  async function handleDelete() {
    setError("");
    setShortfalls([]);
    try {
      await deleteScheme({ orderId: editOrder._id, reason: "Withdrawn by admin" }).unwrap();
      onCreated?.("deleted");
      requestClose();
    } catch (err) {
      setConfirmingDelete(false);
      handleError(err, "Couldn't delete the scheme order.");
    }
  }

  if (!open) return null;

  const recipientName = isEdit
    ? editOrder.dealerSnapshot?.companyName || "Recipient"
    : selectedRecipient?.name || "";

  // Say what's blocking Create instead of leaving a dead button unexplained.
  let summary;
  if (!hasRecipient) summary = "Choose who receives this scheme";
  else if (!liveLines.length) summary = "Add at least one product";
  else if (overCapacity) summary = "Some quantities exceed available stock";
  else {
    summary = `${totalUnits} unit${totalUnits === 1 ? "" : "s"} · ${liveLines.length} product${liveLines.length === 1 ? "" : "s"}${
      recipientName ? ` · ${recipientName}` : ""
    }`;
  }

  return createPortal(
    <div
      className={`sc-overlay ${closing ? "is-closing" : ""}`}
      onClick={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        className="sc-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sc-title"
      >
        <header className="sc-head">
          <div>
            <h3 id="sc-title">{isEdit ? `Edit ${editOrder.orderNumber}` : "New scheme order"}</h3>
            <p>{isEdit ? "Changes move reserved stock." : "Free of cost, shipped from the factory."}</p>
          </div>
          <button type="button" onClick={requestClose} aria-label="Close" className="sc-close">
            <DashboardIcon name="close" size={14} strokeWidth={2.4} />
          </button>
        </header>

        {error ? (
          <div className="sc-alert" role="alert">
            <DashboardIcon name="warning" size={15} strokeWidth={2.2} />
            <div>
              {error}
              {shortfalls.length ? (
                <ul>
                  {shortfalls.map((s) => (
                    <li key={s.productId}>
                      {s.name} — {s.available} left
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="sc-body">
          <div className="sc-side">
            <div className="sc-group">
              <label className="sc-label" htmlFor="sc-name">
                Scheme name
              </label>
              <input
                id="sc-name"
                className="sc-input"
                value={label}
                maxLength={LABEL_MAX}
                autoComplete="off"
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Dashain 2083 Volume Scheme"
              />
            </div>

            <div className="sc-group">
              <span className="sc-label">Recipient</span>
              {isEdit ? (
                <div className="sc-locked">
                  <b>{recipientName}</b>
                  <em>{editOrder.dispatcherCustomerId ? "Dispatcher" : "Dealer"} · can't be changed</em>
                </div>
              ) : selectedRecipient ? (
                // Once chosen, the name replaces the search box - with nothing
                // else on screen listing recipients, this is the only place the
                // admin can read back who they picked.
                <div className="sc-locked">
                  <b>{selectedRecipient.name}</b>
                  <em>{scopeOf(selectedRecipient)?.title || ""}</em>
                  <button type="button" className="sc-change" onClick={() => setRecipientKey("")}>
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <div className="sc-field">
                    <DashboardIcon name="search" size={14} strokeWidth={2.2} />
                    <input
                      value={recipientQuery}
                      autoComplete="off"
                      aria-label="Search recipients"
                      placeholder="Search any dealer or dispatcher"
                      onChange={(e) => setRecipientQuery(e.target.value)}
                      onKeyDown={(e) => {
                        // First Esc clears the search; only a second one closes the dialog.
                        if (e.key === "Escape" && recipientQuery) {
                          e.nativeEvent.stopImmediatePropagation();
                          setRecipientQuery("");
                        } else if (e.key === "Enter" && visibleRecipients[0]) {
                          e.preventDefault();
                          pickRecipient(visibleRecipients[0]);
                        }
                      }}
                    />
                    {recipientQuery ? (
                      <button
                        type="button"
                        className="sc-clear"
                        onClick={() => setRecipientQuery("")}
                        aria-label="Clear recipient search"
                      >
                        <DashboardIcon name="close" size={11} strokeWidth={2.6} />
                      </button>
                    ) : null}
                  </div>

                  <div className="sc-recipients" role="radiogroup" aria-label="Recipients">
                    {!isSearching ? (
                      <p className="sc-hint">Search by company, contact or initials.</p>
                    ) : recipientsQuery.isLoading ? (
                      <p className="sc-empty">Loading…</p>
                    ) : visibleRecipients.length === 0 ? (
                      <p className="sc-empty">Nobody looks like “{recipientQuery.trim()}”.</p>
                    ) : (
                      visibleRecipients.map((r, index) => (
                        <button
                          key={r.key}
                          type="button"
                          role="radio"
                          aria-checked={recipientKey === r.key}
                          className={`sc-recipient ${recipientKey === r.key ? "is-selected" : ""}`}
                          style={{ animationDelay: `${Math.min(index, 6) * 24}ms` }}
                          onClick={() => pickRecipient(r)}
                        >
                          <span className="sc-recipient-name">{r.name}</span>
                          {/* Results span dealers and dispatchers alike, so each
                              row has to say which one it is. */}
                          <span className="sc-recipient-group">{scopeOf(r)?.chip}</span>
                          <DashboardIcon name="checkmark" size={14} strokeWidth={2.8} />
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="sc-group">
              <label className="sc-label" htmlFor="sc-note">
                Note <em>optional</em>
              </label>
              <textarea
                id="sc-note"
                className="sc-input sc-textarea"
                value={note}
                maxLength={NOTE_MAX}
                rows={3}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Shown on the order summary and in the factory's email"
              />
              {note.length > NOTE_MAX - 60 ? (
                <i className="sc-count">
                  {note.length}/{NOTE_MAX}
                </i>
              ) : null}
            </div>
          </div>

          <div className="sc-main">
            <span className="sc-label">Products</span>
            <div className="sc-field">
              <DashboardIcon name="search" size={15} strokeWidth={2.2} />
              <input
                value={query}
                autoComplete="off"
                aria-label="Search products"
                placeholder="Search by name or SKU to add"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // First Esc clears the search; only a second one closes the dialog.
                  if (e.key === "Escape" && query) {
                    e.nativeEvent.stopImmediatePropagation();
                    setQuery("");
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const first = results.find(
                      (p) => availableOf(p) > 0 && !liveLines.some((l) => l.productId === String(p._id)),
                    );
                    if (first) addProduct(first);
                  }
                }}
              />
              {query ? (
                <button type="button" className="sc-clear" onClick={() => setQuery("")} aria-label="Clear search">
                  <DashboardIcon name="close" size={11} strokeWidth={2.6} />
                </button>
              ) : null}
            </div>

            {trimmed.length >= 2 ? (
              <div className="sc-results">
                {productsQuery.isFetching ? (
                  <p className="sc-empty">Searching…</p>
                ) : results.length === 0 ? (
                  <p className="sc-empty">Nothing matches “{trimmed}”.</p>
                ) : (
                  results.map((p) => {
                    const available = availableOf(p);
                    const added = liveLines.some((l) => l.productId === String(p._id));
                    return (
                      <button
                        key={p._id}
                        type="button"
                        className="sc-result"
                        onClick={() => addProduct(p)}
                        disabled={added || available === 0}
                      >
                        {/* Size leads the row. The catalog carries one product
                            name across every pack size, so a search returns
                            rows that are otherwise identical - without this the
                            only way to tell 20L from 1L is to add one and see. */}
                        <span className="sc-result-name">
                          {p.pack?.label ? <b className="sc-size">{p.pack.label}</b> : null}
                          {p.name}
                        </span>
                        <span className={`sc-result-meta ${available === 0 ? "is-out" : ""}`}>
                          {added ? "Added" : available === 0 ? "Out of stock" : `${available} available`}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}

            <div className="sc-lines-scroll">
              {lines.length === 0 ? (
                <p className="sc-lines-empty">Products you add appear here.</p>
              ) : (
                <ul className="sc-lines">
                  {lines.map((line) => {
                    const over = isOver(line);
                    return (
                      <li key={line.productId} className={`sc-line-wrap ${line.leaving ? "is-leaving" : ""}`}>
                        <div className="sc-line-clip">
                          <div className="sc-line">
                            <div className="sc-line-main">
                              <span className="sc-line-name">
                                {line.packLabel ? <b className="sc-size">{line.packLabel}</b> : null}
                                {line.name}
                              </span>
                              {line.available !== null ? (
                                <span className={`sc-stock ${over ? "is-over" : ""}`}>
                                  {over ? `Only ${line.available} available` : `${line.available} available`}
                                </span>
                              ) : null}
                            </div>
                            <span className="sc-qty">
                              <button type="button" aria-label="Decrease" onClick={() => stepQuantity(line, -1)}>
                                <DashboardIcon name="minus" size={11} strokeWidth={2.8} />
                              </button>
                              <input
                                type="number"
                                min="1"
                                inputMode="numeric"
                                value={line.quantity}
                                aria-label={`Quantity for ${line.name}`}
                                onChange={(e) => updateLine(line.productId, { quantity: e.target.value })}
                                onBlur={() => commitQuantity(line)}
                              />
                              <button type="button" aria-label="Increase" onClick={() => stepQuantity(line, 1)}>
                                <DashboardIcon name="plus" size={11} strokeWidth={2.8} />
                              </button>
                            </span>
                            <button
                              type="button"
                              className="sc-remove"
                              aria-label={`Remove ${line.name}`}
                              onClick={() => removeLine(line.productId)}
                            >
                              <DashboardIcon name="close" size={12} strokeWidth={2.4} />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <footer className="sc-foot">
          {/* Delete confirms in place rather than opening a second dialog
              over this one - one destructive action, one extra tap, no
              stacked modals to dismiss. */}
          {isEdit && confirmingDelete ? (
            <>
              <span className="sc-summary is-hint">Delete this scheme order?</span>
              <button type="button" className="sc-btn" onClick={() => setConfirmingDelete(false)} disabled={busy}>
                Keep
              </button>
              <button type="button" className="sc-btn is-danger-solid" onClick={handleDelete} disabled={busy}>
                {deleteState.isLoading ? <Spinner size={13} /> : null}
                Delete
              </button>
            </>
          ) : (
            <>
              {isEdit ? (
                <button type="button" className="sc-btn is-danger" onClick={() => setConfirmingDelete(true)} disabled={busy}>
                  Delete
                </button>
              ) : null}
              <span className={`sc-summary ${canSubmit ? "" : "is-hint"}`}>{summary}</span>
              <button type="button" className="sc-btn" onClick={requestClose} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="sc-btn is-primary" onClick={handleSubmit} disabled={!canSubmit || busy}>
                {createState.isLoading || updateState.isLoading ? <Spinner size={13} /> : null}
                {isEdit
                  ? updateState.isLoading
                    ? "Saving…"
                    : "Save changes"
                  : createState.isLoading
                    ? "Creating…"
                    : "Create scheme order"}
              </button>
            </>
          )}
        </footer>
      </div>

      <style>{`
        .sc-overlay{
          --sc-ease: var(--ease-out, cubic-bezier(.23,1,.32,1));
          --sc-ink: var(--color-ink, #1d1d1f);
          --sc-graphite: var(--color-graphite, #6e6e73);
          --sc-fog: var(--color-fog, #f5f5f7);
          --sc-azure: var(--color-azure, #0071e3);
          --sc-red: #b42318;
          --sc-line: rgba(29,29,31,.08);
          --sc-pad: 24px;
          position:fixed; inset:0; z-index:10001;
          display:grid; place-items:center;
          padding:max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left));
          background:rgba(0,0,0,.4);
          backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
          animation:sc-overlay-in .2s ease-out backwards;
        }
        .sc-overlay.is-closing{ animation:sc-overlay-out .15s ease-out forwards; }

        .sc-card{
          width:min(960px,100%);
          height:min(660px, calc(100vh - 48px)); height:min(660px, calc(100dvh - 48px));
          display:flex; flex-direction:column;
          background:#fff; color:var(--sc-ink);
          border-radius:22px; overflow:hidden; outline:none;
          box-shadow:0 30px 70px rgba(0,0,0,.22), 0 0 0 1px rgba(0,0,0,.05);
          animation:sc-card-in .24s var(--sc-ease) backwards;
        }
        .sc-overlay.is-closing .sc-card{ animation:sc-card-out .15s var(--sc-ease) forwards; }

        .sc-head{ flex:none; display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:22px var(--sc-pad) 16px; }
        .sc-head h3{ margin:0; font-size:20px; font-weight:650; letter-spacing:-.015em; }
        .sc-head p{ margin:3px 0 0; font-size:13px; color:var(--sc-graphite); }
        .sc-close{
          flex:none; width:32px; height:32px; margin:-4px -8px 0 0;
          display:grid; place-items:center; border:0; border-radius:50%;
          background:transparent; color:var(--sc-graphite); cursor:pointer;
          transition:background .15s ease, transform .16s var(--sc-ease);
        }
        .sc-close:active{ transform:scale(.92); }

        .sc-alert{
          flex:none; display:flex; gap:10px; align-items:flex-start; margin:0 var(--sc-pad) 12px; padding:12px 14px;
          border-radius:12px; background:rgba(180,35,24,.07); color:var(--sc-red); font-size:13px; font-weight:550;
        }
        .sc-alert svg{ flex:none; margin-top:1px; }
        .sc-alert ul{ margin:6px 0 0; padding-left:16px; font-weight:500; }

        /* Two panes: details on the left, products on the right, split by a
           hairline. Each pane scrolls on its own so the footer never moves. */
        .sc-body{
          flex:1 1 auto; min-height:0;
          display:grid; grid-template-columns:minmax(300px,370px) minmax(0,1fr); grid-template-rows:minmax(0,1fr);
          border-top:1px solid var(--sc-line);
        }
        .sc-side{
          min-height:0; overflow-y:auto; overscroll-behavior:contain;
          display:flex; flex-direction:column; gap:22px; padding:22px var(--sc-pad) 26px;
        }
        .sc-main{
          min-width:0; min-height:0; display:flex; flex-direction:column;
          padding:22px var(--sc-pad) 0; border-left:1px solid var(--sc-line);
        }
        .sc-group{ display:flex; flex-direction:column; }
        .sc-label{ margin-bottom:9px; font-size:12px; font-weight:600; letter-spacing:.01em; color:var(--sc-graphite); }
        .sc-label em{ margin-left:4px; font-style:normal; font-weight:500; color:#9a9aa0; }

        .sc-input{
          width:100%; height:44px; padding:0 14px; border:1px solid transparent; border-radius:12px; outline:none;
          background:var(--sc-fog); color:var(--sc-ink); font:inherit; font-size:14px;
          transition:background .15s ease, border-color .15s ease, box-shadow .15s ease;
        }
        .sc-input::placeholder{ color:#9a9aa0; }
        .sc-input:focus{ background:#fff; border-color:var(--sc-azure); box-shadow:0 0 0 3px rgba(0,113,227,.14); }
        .sc-textarea{ height:auto; padding:12px 14px; line-height:1.5; resize:none; }
        .sc-count{ margin-top:6px; align-self:flex-end; font-size:11px; font-style:normal; color:#b64400; }

        .sc-field{
          flex:none; display:flex; align-items:center; gap:10px; height:44px; padding:0 14px;
          border:1px solid transparent; border-radius:12px; background:var(--sc-fog); color:var(--sc-graphite);
          transition:background .15s ease, border-color .15s ease, box-shadow .15s ease;
        }
        .sc-field:focus-within{ background:#fff; border-color:var(--sc-azure); box-shadow:0 0 0 3px rgba(0,113,227,.14); }
        .sc-field input{ flex:1; min-width:0; border:0; outline:none; background:transparent; font:inherit; font-size:14px; color:var(--sc-ink); }
        .sc-field input::placeholder{ color:#9a9aa0; }
        .sc-clear{
          flex:none; width:20px; height:20px; display:grid; place-items:center; border:0; border-radius:50%;
          background:rgba(0,0,0,.08); color:var(--sc-graphite); cursor:pointer;
        }

        .sc-recipients{ display:flex; flex-direction:column; gap:2px; margin-top:6px; max-height:216px; overflow-y:auto; overscroll-behavior:contain; }
        .sc-recipient{
          flex:none; display:flex; align-items:center; justify-content:space-between; gap:10px;
          min-height:42px; padding:0 12px; border:0; border-radius:10px; background:transparent;
          font:inherit; font-size:14px; font-weight:550; color:var(--sc-ink); text-align:left; cursor:pointer;
          animation:sc-row-in .2s var(--sc-ease) backwards;
          transition:background .12s ease, transform .16s var(--sc-ease);
        }
        .sc-recipient-name{ flex:1; min-width:0; overflow-wrap:anywhere; }
        .sc-recipient-group{
          flex:none; padding:2px 8px; border-radius:999px; background:var(--sc-fog);
          font-size:11px; font-weight:600; color:var(--sc-graphite); white-space:nowrap;
        }
        .sc-recipient.is-selected .sc-recipient-group{ background:rgba(0,113,227,.12); color:var(--sc-azure); }
        .sc-recipient svg{ flex:none; color:var(--sc-azure); opacity:0; transform:scale(.8); transition:opacity .15s ease, transform .2s var(--sc-ease); }
        .sc-recipient:active{ transform:scale(.985); }
        .sc-recipient.is-selected{ background:rgba(0,113,227,.09); color:var(--sc-azure); }
        .sc-recipient.is-selected svg{ opacity:1; transform:scale(1); }
        .sc-locked{
          display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center;
          gap:0 12px; padding:12px 14px; border-radius:12px; background:var(--sc-fog);
          animation:sc-pop .18s var(--sc-ease) backwards;
        }
        .sc-locked b{ grid-column:1; font-size:14px; font-weight:600; overflow-wrap:anywhere; }
        .sc-locked em{ grid-column:1; font-style:normal; font-size:12px; color:var(--sc-graphite); }
        .sc-change{
          grid-column:2; grid-row:1 / span 2; align-self:center;
          border:0; background:none; padding:4px; font:inherit; font-size:13px; font-weight:600;
          color:var(--sc-azure); cursor:pointer; white-space:nowrap;
          transition:opacity .15s ease, transform .16s var(--sc-ease);
        }
        .sc-change:active{ transform:scale(.97); }
        .sc-empty{ margin:0; padding:14px 4px; font-size:13px; color:var(--sc-graphite); }
        .sc-hint{ margin:0; padding:10px 4px 2px; font-size:12.5px; color:#9a9aa0; }

        .sc-results{
          flex:none; margin-top:8px; padding:4px; max-height:188px; overflow-y:auto; overscroll-behavior:contain;
          border:1px solid var(--sc-line); border-radius:14px; background:#fff;
          animation:sc-pop .18s var(--sc-ease) backwards;
        }
        .sc-result{
          width:100%; display:flex; align-items:center; justify-content:space-between; gap:12px;
          padding:10px; border:0; border-radius:10px; background:transparent; color:var(--sc-ink);
          font:inherit; font-size:14px; text-align:left; cursor:pointer;
          transition:background .12s ease, transform .16s var(--sc-ease);
        }
        .sc-result:active:not(:disabled){ transform:scale(.985); }
        .sc-result:disabled{ cursor:default; opacity:.5; }
        .sc-result-name{ min-width:0; font-weight:550; overflow-wrap:anywhere; }
        .sc-result-meta{ flex:none; font-size:12px; color:var(--sc-graphite); }
        .sc-result-meta.is-out{ color:var(--sc-red); }
        .sc-size{
          display:inline-block; margin-right:8px; padding:1px 7px; border-radius:6px;
          background:var(--sc-fog); font-size:12px; font-weight:650; color:var(--sc-ink); vertical-align:1px;
        }

        .sc-lines-scroll{ flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior:contain; margin:10px -8px 0; padding:0 8px 22px; }
        .sc-lines-empty{ margin:0; min-height:140px; display:grid; place-items:center; text-align:center; font-size:13px; color:#9a9aa0; }
        .sc-lines{ list-style:none; margin:0; padding:0; }
        .sc-line-wrap{
          display:grid; grid-template-rows:1fr;
          transition:grid-template-rows .17s var(--sc-ease), opacity .15s ease-out;
          animation:sc-row-in .2s var(--sc-ease) backwards;
        }
        .sc-line-wrap.is-leaving{ grid-template-rows:0fr; opacity:0; }
        .sc-line-clip{ min-height:0; overflow:hidden; }
        .sc-line-wrap + .sc-line-wrap .sc-line{ border-top:1px solid var(--sc-line); }
        .sc-line{ display:flex; align-items:center; gap:12px; padding:13px 0; }
        .sc-line-main{ flex:1; min-width:0; display:grid; gap:2px; }
        .sc-line-name{ font-size:14px; font-weight:550; overflow-wrap:anywhere; }
        .sc-stock{ font-size:12px; color:var(--sc-graphite); }
        .sc-stock.is-over{ color:var(--sc-red); font-weight:600; }

        .sc-qty{ flex:none; display:inline-flex; align-items:center; height:34px; border-radius:10px; background:var(--sc-fog); }
        .sc-qty button{
          width:32px; height:34px; display:grid; place-items:center; border:0; border-radius:10px;
          background:transparent; color:var(--sc-ink); cursor:pointer;
          transition:background .12s ease, transform .16s var(--sc-ease);
        }
        .sc-qty button:active{ transform:scale(.9); }
        .sc-qty input{
          width:50px; height:34px; border:0; outline:none; background:transparent; text-align:center;
          font:inherit; font-size:14px; font-weight:600; color:var(--sc-ink); appearance:textfield; -moz-appearance:textfield;
        }
        .sc-qty input::-webkit-inner-spin-button, .sc-qty input::-webkit-outer-spin-button{ appearance:none; margin:0; }
        .sc-remove{
          flex:none; width:30px; height:30px; display:grid; place-items:center; border:0; border-radius:50%;
          background:transparent; color:#9a9aa0; cursor:pointer;
          transition:color .15s ease, background .15s ease, transform .16s var(--sc-ease);
        }
        .sc-remove:active{ transform:scale(.9); }

        .sc-foot{
          flex:none; display:flex; align-items:center; gap:10px;
          padding:14px var(--sc-pad) 18px; border-top:1px solid var(--sc-line);
        }
        .sc-summary{ flex:1; min-width:0; font-size:13px; font-weight:550; color:var(--sc-ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .sc-summary.is-hint{ font-weight:500; color:var(--sc-graphite); }
        .sc-btn{
          flex:none; height:40px; padding:0 18px; display:inline-flex; align-items:center; justify-content:center; gap:8px;
          border:0; border-radius:999px; background:transparent; color:var(--sc-ink);
          font:inherit; font-size:14px; font-weight:600; white-space:nowrap; cursor:pointer;
          transition:background .15s ease, opacity .15s ease, transform .16s var(--sc-ease);
        }
        .sc-btn:active:not(:disabled){ transform:scale(.97); }
        .sc-btn:disabled{ cursor:not-allowed; opacity:.4; }
        .sc-btn.is-primary{ background:var(--sc-azure); color:#fff; }
        .sc-btn.is-danger{ color:var(--sc-red); padding-left:0; padding-right:8px; }
        .sc-btn.is-danger-solid{ background:var(--sc-red); color:#fff; }

        .sc-overlay button:focus-visible{ outline:2px solid var(--sc-azure); outline-offset:2px; }

        @media (hover:hover) and (pointer:fine){
          .sc-close:hover, .sc-btn:hover:not(:disabled):not(.is-primary):not(.is-danger-solid){ background:var(--sc-fog); }
          .sc-btn.is-primary:hover:not(:disabled){ background:#0077ed; }
          .sc-btn.is-danger-solid:hover:not(:disabled){ background:#9a1c11; }
          .sc-btn.is-danger:hover:not(:disabled){ background:rgba(180,35,24,.07); }
          .sc-recipient:hover:not(.is-selected), .sc-result:hover:not(:disabled){ background:var(--sc-fog); }
          .sc-change:hover{ opacity:.7; }
          .sc-qty button:hover{ background:rgba(0,0,0,.06); }
          .sc-remove:hover{ color:var(--sc-red); background:rgba(180,35,24,.08); }
          .sc-field:hover:not(:focus-within), .sc-input:hover:not(:focus){ background:#efeff2; }
        }

        /* Touch: every control gets a thumb-sized target. */
        @media (pointer:coarse){
          .sc-recipient{ min-height:48px; }
          .sc-result{ padding:13px 10px; }
          .sc-qty, .sc-qty button, .sc-qty input{ height:40px; }
          .sc-qty button{ width:40px; }
          .sc-remove{ width:38px; height:38px; }
          .sc-btn{ height:46px; }
          .sc-close{ width:40px; height:40px; }
          .sc-clear{ width:26px; height:26px; }
        }

        /* Very large displays: same layout, a little more room. */
        @media (min-width:1600px) and (min-height:900px){
          .sc-card{ width:min(1040px,100%); height:min(720px, calc(100vh - 96px)); height:min(720px, calc(100dvh - 96px)); }
        }

        /* Narrow or short screens (tablets in portrait, small windows, phones in
           landscape): the two panes become one scrolling column - name,
           recipient, products, then the optional note - so nothing is squeezed
           side-by-side or pushed off the bottom. */
        @media (max-width:860px), (max-height:600px){
          .sc-card{ width:min(640px,100%); height:auto; max-height:calc(100vh - 48px); max-height:calc(100dvh - 48px); }
          .sc-body{ display:flex; flex-direction:column; gap:24px; padding:22px var(--sc-pad) 26px; overflow-y:auto; overscroll-behavior:contain; }
          .sc-side{ display:contents; }
          .sc-side > .sc-group, .sc-main{ flex:none; }
          .sc-side > .sc-group:nth-child(1){ order:1; }
          .sc-side > .sc-group:nth-child(2){ order:2; }
          .sc-side > .sc-group:nth-child(3){ order:4; }
          .sc-main{ order:3; padding:0; border:0; }
          .sc-lines-scroll{ overflow:visible; margin:10px 0 0; padding:0; }
          .sc-recipients{ max-height:264px; }
        }

        /* Phones (and anything short): a bottom sheet, edge to edge. */
        @media (max-width:600px), (max-height:600px){
          .sc-overlay{ place-items:end center; padding:env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left); }
          .sc-card{
            width:min(680px,100%); max-height:calc(100vh - 10px); max-height:calc(100dvh - 10px);
            border-radius:22px 22px 0 0; animation-name:sc-sheet-in;
          }
          .sc-overlay.is-closing .sc-card{ animation-name:sc-sheet-out; }
        }
        @media (max-width:600px){
          .sc-overlay{ --sc-pad: 18px; }
          .sc-head{ padding-top:20px; }
          .sc-foot{ flex-wrap:wrap; padding-bottom:max(16px, env(safe-area-inset-bottom)); }
          .sc-summary{ flex:1 1 100%; }
          .sc-btn{ flex:1; }
          .sc-btn.is-danger{ flex:none; }
          .sc-btn.is-danger + .sc-summary{ flex:1 1 0; }
          .sc-input, .sc-field input, .sc-qty input{ font-size:16px; }
        }
        @media (max-height:600px){
          .sc-head{ padding-top:14px; padding-bottom:10px; }
          .sc-head p{ display:none; }
          .sc-foot{ padding-top:10px; padding-bottom:max(12px, env(safe-area-inset-bottom)); }
        }
        @media (max-width:340px){
          .sc-qty input{ width:40px; }
        }

        @keyframes sc-overlay-in{ from{ opacity:0; } }
        @keyframes sc-overlay-out{ to{ opacity:0; } }
        @keyframes sc-card-in{ from{ opacity:0; transform:translateY(10px) scale(.98); } }
        @keyframes sc-card-out{ to{ opacity:0; transform:translateY(6px) scale(.985); } }
        @keyframes sc-sheet-in{ from{ transform:translateY(32px); opacity:.6; } }
        @keyframes sc-sheet-out{ to{ transform:translateY(24px); opacity:0; } }
        @keyframes sc-pop{ from{ opacity:0; transform:translateY(-4px); } }
        @keyframes sc-row-in{ from{ opacity:0; transform:translateY(4px); } }
        @keyframes sc-fade-in{ from{ opacity:0; } }

        @media (prefers-reduced-motion:reduce){
          .sc-card{ animation-name:sc-fade-in; }
          .sc-overlay.is-closing .sc-card{ animation-name:sc-overlay-out; }
          .sc-results, .sc-recipient, .sc-line-wrap{ animation-name:sc-fade-in; }
          .sc-line-wrap, .sc-recipient svg{ transition-duration:.01ms; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
