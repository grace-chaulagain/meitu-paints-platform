import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  useCreateSchemeOrderMutation,
  useUpdateSchemeOrderMutation,
  useDeleteSchemeOrderMutation,
  useGetSchemeRecipientsQuery,
  useGetProductsQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import { AppleDropdown } from "../../../components/dashboard/ApplePickers.jsx";
import { Spinner } from "../../../components/dashboard/DashboardUI.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";

// Each scope carries its own hue so the choice is readable at a glance
// rather than three identical grey cards. Amber is the scheme's own
// identity colour (it matches the SCHEME badge used across the portals).
const SCOPES = [
  { key: "FACTORY_DEALERS", label: "Factory dealers", icon: "store", hue: "azure" },
  { key: "DISPATCHER_DEALERS", label: "Via dispatcher", icon: "handshake", hue: "violet" },
  { key: "DISPATCHERS", label: "Dispatchers", icon: "truck", hue: "teal" },
];

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

// Pass `editOrder` to amend an existing scheme instead of raising a new one.
// The recipient is fixed once a scheme exists - pointing a grant at a
// different dealer is a different decision, and the server rejects it - so in
// edit mode the picker collapses to a read-only line.
export default function CreateSchemeOrderModal({ open, onClose, onCreated, editOrder = null }) {
  const isEdit = Boolean(editOrder);
  const recipientsQuery = useGetSchemeRecipientsQuery(undefined, { skip: !open || isEdit });
  const [createScheme, createState] = useCreateSchemeOrderMutation();
  const [updateScheme, updateState] = useUpdateSchemeOrderMutation();
  const [deleteScheme, deleteState] = useDeleteSchemeOrderMutation();

  const [scope, setScope] = useState("");
  const [recipientKey, setRecipientKey] = useState("");
  // Seeded from the order rather than synced to it in an effect: the caller
  // mounts this fresh per scheme (keyed on the order id), so the initial
  // value IS the edit state and there's nothing to keep in sync afterwards.
  const [label, setLabel] = useState(() => editOrder?.scheme?.label || "");
  const [lines, setLines] = useState(() => linesFromOrder(editOrder));
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [shortfalls, setShortfalls] = useState([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const busy = createState.isLoading || updateState.isLoading || deleteState.isLoading;

  const trimmed = query.trim();
  const productsQuery = useGetProductsQuery({ q: trimmed }, { skip: !open || trimmed.length < 2 });
  const results = productsQuery.data || [];

  const recipients = useMemo(() => recipientsQuery.data || [], [recipientsQuery.data]);
  const scopeCounts = useMemo(() => {
    const counts = {};
    SCOPES.forEach((s) => {
      counts[s.key] = recipients.filter((r) => matchesScope(r, s.key)).length;
    });
    return counts;
  }, [recipients]);

  const recipientOptions = useMemo(
    () => recipients.filter((r) => matchesScope(r, scope)).map((r) => ({ key: r.key, label: r.name })),
    [recipients, scope],
  );

  const selectedRecipient = recipients.find((r) => r.key === recipientKey) || null;
  const [recipientType, recipientId] = recipientKey ? recipientKey.split(":") : ["", ""];
  const totalUnits = lines.reduce((sum, l) => sum + Number(l.quantity || 0), 0);

  const availableOf = (p) =>
    Math.max(0, Number(p.stock?.currentQuantity || 0) - Number(p.stock?.reservedQuantity || 0));

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

  function reset() {
    setScope("");
    setRecipientKey("");
    setLabel("");
    setLines([]);
    setQuery("");
    setError("");
    setShortfalls([]);
    setConfirmingDelete(false);
  }

  function handleClose() {
    if (busy) return;
    reset();
    onClose();
  }

  // `available: null` means unknown-and-server-checked, so it can't be over.
  const overCapacity = lines.some((l) => l.available !== null && Number(l.quantity) > l.available);
  const canSubmit = (isEdit || Boolean(recipientId)) && lines.length > 0 && !overCapacity;

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
    const items = lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }));
    try {
      if (isEdit) {
        await updateScheme({ orderId: editOrder._id, label: label.trim(), items }).unwrap();
      } else {
        await createScheme({ recipientType, recipientId, label: label.trim(), items }).unwrap();
      }
      onCreated?.();
      reset();
      onClose();
    } catch (err) {
      handleError(err, isEdit ? "Couldn't save the changes." : "Couldn't create the scheme order.");
    }
  }

  async function handleDelete() {
    setError("");
    setShortfalls([]);
    try {
      await deleteScheme({ orderId: editOrder._id, reason: "Withdrawn by admin" }).unwrap();
      onCreated?.();
      reset();
      onClose();
    } catch (err) {
      setConfirmingDelete(false);
      handleError(err, "Couldn't delete the scheme order.");
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="sch-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div
        className="sch-card"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit scheme order" : "Create scheme order"}
      >
        {/* Header and footer stay put; only the middle scrolls, so the
            card can never grow past the viewport however many products
            are added or however long the dropdown list is. */}
        <header className="sch-head">
          <span className="sch-mark">
            <DashboardIcon name="award" size={16} strokeWidth={2} />
          </span>
          <div className="sch-head-text">
            <h3>{isEdit ? `Edit ${editOrder.orderNumber}` : "Scheme order"}</h3>
            <p>
              {isEdit
                ? "Still in the factory queue · changes move reserved stock"
                : "Free of cost · ships from factory"}
            </p>
          </div>
          <button type="button" onClick={handleClose} aria-label="Close" className="sch-close">
            <DashboardIcon name="close" size={13} strokeWidth={2.4} />
          </button>
        </header>

        <div className="sch-body">
          {error ? (
            <div className="sch-alert" role="alert">
              <DashboardIcon name="warning" size={14} strokeWidth={2.2} />
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

          <div className="sch-field">
            <label>Recipient</label>
            {isEdit ? (
              <div className="sch-locked">
                <DashboardIcon name="user" size={14} strokeWidth={2} />
                <span>{editOrder.dealerSnapshot?.companyName || "Recipient"}</span>
                <em>Can't be changed — delete and raise a new scheme instead</em>
              </div>
            ) : (
              <>
            <div className="sch-scopes">
              {SCOPES.map((s) => {
                const count = scopeCounts[s.key] ?? 0;
                return (
                  <button
                    key={s.key}
                    type="button"
                    data-hue={s.hue}
                    className={`sch-scope ${scope === s.key ? "is-active" : ""}`}
                    onClick={() => {
                      setScope(s.key);
                      setRecipientKey("");
                    }}
                    disabled={!count}
                  >
                    <DashboardIcon name={s.icon} size={18} strokeWidth={1.9} />
                    <span>{s.label}</span>
                    <b>{count}</b>
                  </button>
                );
              })}
            </div>

            {scope ? (
              <div className="sch-reveal">
                <AppleDropdown
                  value={recipientKey}
                  options={recipientOptions}
                  onChange={setRecipientKey}
                  placeholder={recipientsQuery.isLoading ? "Loading…" : "Select name"}
                  icon="user"
                  style={{ width: "100%" }}
                />
              </div>
            ) : null}
            </>
            )}
          </div>

          <div className="sch-field">
            <label>Products</label>
            <div className="sch-search">
              <DashboardIcon name="search" size={14} strokeWidth={2.2} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, SKU or code…"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear">
                  <DashboardIcon name="close" size={11} strokeWidth={2.6} />
                </button>
              ) : null}
            </div>

            {trimmed.length >= 2 ? (
              <div className="sch-results sch-reveal">
                {productsQuery.isFetching ? (
                  <p className="sch-muted">Searching…</p>
                ) : results.length === 0 ? (
                  <p className="sch-muted">Nothing matches “{trimmed}”.</p>
                ) : (
                  results.slice(0, 5).map((p) => {
                    const available = availableOf(p);
                    const added = lines.some((l) => l.productId === String(p._id));
                    return (
                      <button
                        key={p._id}
                        type="button"
                        className="sch-result"
                        onClick={() => addProduct(p)}
                        disabled={added || available === 0}
                      >
                        {/* Size leads the row. The catalog carries one
                            product name across every pack size, so a search
                            for "high glossy exterior" returns five rows that
                            are otherwise character-for-character identical -
                            without this the only way to tell 20L from 1L is
                            to add one and see what lands. */}
                        <span className="sch-result-name">
                          {p.pack?.label ? <b className="sch-size">{p.pack.label}</b> : null}
                          {p.name}
                        </span>
                        <span className={`sch-chip ${available === 0 ? "is-out" : ""}`}>
                          {available === 0 ? "none" : available}
                        </span>
                        <DashboardIcon name={added ? "checkmark" : "plus"} size={13} strokeWidth={2.6} />
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}

            {lines.length ? (
              <ul className="sch-lines">
                {lines.map((line, index) => (
                  <li
                    key={line.productId}
                    // `available: null` is "server decides" (a line already on
                    // the scheme). Without the explicit null guard this reads
                    // as `n > 0` and paints every prefilled line as over
                    // capacity the moment the edit modal opens.
                    className={`sch-line ${
                      line.available !== null && Number(line.quantity) > line.available ? "is-over" : ""
                    }`}
                  >
                    <span className="sch-line-name">
                      {line.packLabel ? <b className="sch-size">{line.packLabel}</b> : null}
                      {line.name}
                    </span>
                    <span className="sch-step">
                      <button
                        type="button"
                        aria-label="Decrease"
                        onClick={() =>
                          setLines((c) =>
                            c.map((l, i) =>
                              i === index ? { ...l, quantity: Math.max(1, Number(l.quantity) - 1) } : l,
                            ),
                          )
                        }
                      >
                        <DashboardIcon name="minus" size={11} strokeWidth={2.8} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) =>
                          setLines((c) => c.map((l, i) => (i === index ? { ...l, quantity: e.target.value } : l)))
                        }
                      />
                      <button
                        type="button"
                        aria-label="Increase"
                        onClick={() =>
                          setLines((c) =>
                            c.map((l, i) => (i === index ? { ...l, quantity: Number(l.quantity) + 1 } : l)),
                          )
                        }
                      >
                        <DashboardIcon name="plus" size={11} strokeWidth={2.8} />
                      </button>
                    </span>
                    <button
                      type="button"
                      className="sch-remove"
                      aria-label={`Remove ${line.name}`}
                      onClick={() => setLines((c) => c.filter((_, i) => i !== index))}
                    >
                      <DashboardIcon name="close" size={12} strokeWidth={2.4} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="sch-field">
            <label>Scheme name</label>
            <input
              className="sch-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Dashain 2083 Volume Scheme"
            />
          </div>
        </div>

        <footer className="sch-foot">
          {/* Delete confirms in place rather than opening a second dialog
              over this one - one destructive action, one extra tap, no
              stacked modals to dismiss. */}
          {isEdit ? (
            confirmingDelete ? (
              <span className="sch-confirm">
                <b>Delete this scheme?</b>
                <button type="button" onClick={handleDelete} disabled={busy} className="sch-confirm-yes">
                  {deleteState.isLoading ? <Spinner size={12} /> : null}
                  Delete
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)} disabled={busy}>
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="sch-btn is-danger"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
              >
                <DashboardIcon name="trash" size={13} strokeWidth={2.2} />
                Delete
              </button>
            )
          ) : (
            <span className="sch-total">
              {lines.length ? (
                <>
                  <b>{totalUnits}</b> units
                  {selectedRecipient ? ` · ${selectedRecipient.name}` : ""}
                </>
              ) : (
                <span className="sch-muted">Nothing added yet</span>
              )}
            </span>
          )}
          <div className="sch-actions">
            {isEdit && !confirmingDelete ? (
              <span className="sch-total sch-total-inline">
                <b>{totalUnits}</b> units
              </span>
            ) : null}
            <button type="button" className="sch-btn" onClick={handleClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="sch-btn is-primary"
              onClick={handleSubmit}
              disabled={!canSubmit || busy || confirmingDelete}
            >
              {createState.isLoading || updateState.isLoading ? <Spinner size={13} /> : null}
              {isEdit
                ? updateState.isLoading
                  ? "Saving…"
                  : "Save changes"
                : createState.isLoading
                  ? "Creating…"
                  : "Create"}
            </button>
          </div>
        </footer>
      </div>

      <style>{`
        .sch-overlay{
          position:fixed; inset:0; z-index:1600;
          display:grid; place-items:center; padding:24px;
          background:rgba(245,245,247,.72);
          backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);
          animation:sch-fade 160ms ease-out both;
        }
        .sch-card{
          width:min(680px, 100%);
          /* Never taller than the viewport - the body scrolls instead. */
          max-height:min(760px, calc(100vh - 48px));
          display:flex; flex-direction:column;
          border-radius:26px;
          background:var(--color-snow, #fff);
          border:1px solid rgba(29,29,31,.09);
          overflow:hidden;
          animation:sch-pop 220ms cubic-bezier(0.23,1,0.32,1) both;
        }

        .sch-head{
          flex:0 0 auto;
          display:flex; align-items:center; gap:12px;
          padding:20px 22px;
          border-bottom:1px solid rgba(29,29,31,.07);
        }
        .sch-mark{
          width:34px; height:34px; border-radius:11px;
          display:grid; place-items:center;
          background:linear-gradient(140deg,#ffb020,#ff8a00);
          color:#fff;
        }
        .sch-head-text{ flex:1; min-width:0; }
        .sch-head h3{ margin:0; font-size:16px; font-weight:700; letter-spacing:-.01em; color:var(--color-ink,#1d1d1f); }
        .sch-head p{ margin:1px 0 0; font-size:12px; font-weight:500; color:#ff8a00; }
        .sch-close{
          width:30px; height:30px; border-radius:999px; border:none;
          background:var(--color-fog,#f5f5f7); color:var(--color-graphite,#707070);
          cursor:pointer; display:grid; place-items:center;
          transition:background 140ms ease-out, transform 110ms ease-out;
        }
        .sch-close:active{ transform:scale(0.92); }

        .sch-body{
          flex:1 1 auto; min-height:0; overflow-y:auto;
          padding:22px; display:grid; gap:22px;
          overscroll-behavior:contain;
        }

        .sch-field{ display:grid; gap:9px; }
        .sch-field > label{
          font-size:11px; font-weight:700; letter-spacing:.06em;
          text-transform:uppercase; color:var(--color-graphite,#707070);
        }

        .sch-scopes{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
        .sch-scope{
          display:flex; flex-direction:column; align-items:flex-start; gap:5px;
          padding:13px; border-radius:15px; cursor:pointer; text-align:left;
          border:1.5px solid var(--color-silver-mist,#e8e8ed);
          background:var(--color-snow,#fff);
          color:var(--color-graphite,#707070);
          transition:border-color 150ms ease-out, background 150ms ease-out, color 150ms ease-out, transform 110ms ease-out;
        }
        .sch-scope span{ font-size:12.5px; font-weight:650; color:var(--color-ink,#1d1d1f); line-height:1.2; }
        .sch-scope b{ font-size:11px; font-weight:600; color:var(--color-graphite,#707070); }
        .sch-scope:disabled{ opacity:.4; cursor:not-allowed; }
        .sch-scope:not(:disabled):active{ transform:scale(0.98); }
        .sch-scope[data-hue="azure"].is-active{ border-color:#0071e3; background:rgba(0,113,227,.07); color:#0071e3; }
        .sch-scope[data-hue="violet"].is-active{ border-color:#7c5cff; background:rgba(124,92,255,.08); color:#7c5cff; }
        .sch-scope[data-hue="teal"].is-active{ border-color:#00a0a0; background:rgba(0,160,160,.08); color:#00a0a0; }
        .sch-scope.is-active b{ color:inherit; }

        .sch-search{
          display:flex; align-items:center; gap:9px;
          height:44px; padding:0 13px; border-radius:14px;
          background:var(--color-fog,#f5f5f7);
          border:1.5px solid transparent; color:var(--color-graphite,#707070);
          transition:border-color 150ms ease-out, background 150ms ease-out;
        }
        .sch-search:focus-within{ border-color:#0071e3; background:var(--color-snow,#fff); }
        .sch-search input{
          flex:1; min-width:0; border:none; background:transparent; outline:none;
          font-size:14px; color:var(--color-ink,#1d1d1f);
        }
        .sch-search > button{
          border:none; background:transparent; cursor:pointer; padding:3px;
          color:var(--color-graphite,#707070); display:grid; place-items:center;
        }

        .sch-results{ display:grid; gap:2px; padding:5px; border-radius:14px; background:var(--color-fog,#f5f5f7); }
        .sch-result{
          display:flex; align-items:center; gap:10px;
          padding:9px 10px; border-radius:11px; cursor:pointer; text-align:left;
          border:none; background:transparent; color:#0071e3;
          transition:background 130ms ease-out;
        }
        .sch-result:disabled{ opacity:.45; cursor:not-allowed; }
        .sch-result-name{
          flex:1; min-width:0; font-size:13px; font-weight:600; color:var(--color-ink,#1d1d1f);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .sch-chip{
          flex:0 0 auto; padding:2px 8px; border-radius:999px;
          font-size:11px; font-weight:700;
          background:rgba(0,160,90,.12); color:#0a7f4f;
          font-variant-numeric:tabular-nums;
        }
        .sch-chip.is-out{ background:rgba(180,35,24,.1); color:#b42318; }

        .sch-lines{ list-style:none; margin:0; padding:0; display:grid; gap:6px; }
        .sch-line{
          display:flex; align-items:center; gap:10px;
          padding:8px 8px 8px 13px; border-radius:14px;
          background:var(--color-fog,#f5f5f7);
          border:1.5px solid transparent;
          animation:sch-in 190ms cubic-bezier(0.23,1,0.32,1) both;
        }
        .sch-line.is-over{ border-color:#b42318; background:rgba(180,35,24,.05); }
        .sch-line-name{
          flex:1; min-width:0; font-size:13px; font-weight:600; color:var(--color-ink,#1d1d1f);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        /* Pack size, set ahead of the name in both the search results and
           the chosen lines. Fixed min-width and tabular figures so the sizes
           form a column and the names all start on the same x - the point is
           to scan down "20L / 10L / 4L / 1L", not to read each row. */
        .sch-size{
          display:inline-block; min-width:38px; margin-right:9px;
          padding:2px 7px; border-radius:7px;
          font-size:11px; font-weight:750; letter-spacing:.01em;
          text-align:center; font-variant-numeric:tabular-nums;
          background:rgba(29,29,31,.06); color:var(--color-graphite,#707070);
          vertical-align:1px;
        }
        .sch-line .sch-size{ background:rgba(29,29,31,.08); }

        .sch-step{
          flex:0 0 auto; display:flex; align-items:center;
          background:var(--color-snow,#fff); border-radius:999px; padding:2px;
        }
        .sch-step button{
          width:26px; height:26px; border-radius:999px; border:none; cursor:pointer;
          background:transparent; color:var(--color-ink,#1d1d1f);
          display:grid; place-items:center;
          transition:background 130ms ease-out, transform 110ms ease-out;
        }
        .sch-step button:active{ transform:scale(0.88); }
        .sch-step input{
          width:34px; text-align:center; border:none; background:transparent; outline:none;
          font-size:13px; font-weight:700; color:var(--color-ink,#1d1d1f);
          font-variant-numeric:tabular-nums; -moz-appearance:textfield;
        }
        .sch-step input::-webkit-outer-spin-button,
        .sch-step input::-webkit-inner-spin-button{ -webkit-appearance:none; margin:0; }

        .sch-remove{
          flex:0 0 auto; width:26px; height:26px; border-radius:999px; border:none;
          background:transparent; color:var(--color-graphite,#707070); cursor:pointer;
          display:grid; place-items:center;
          transition:background 130ms ease-out, color 130ms ease-out, transform 110ms ease-out;
        }
        .sch-remove:active{ transform:scale(0.88); }

        .sch-input{
          height:44px; padding:0 13px; border-radius:14px;
          border:1.5px solid transparent; background:var(--color-fog,#f5f5f7);
          font-size:14px; color:var(--color-ink,#1d1d1f); outline:none; width:100%;
          transition:border-color 150ms ease-out, background 150ms ease-out;
        }
        .sch-input:focus{ border-color:#0071e3; background:var(--color-snow,#fff); }

        .sch-alert{
          display:flex; align-items:flex-start; gap:8px;
          padding:11px 13px; border-radius:13px;
          background:rgba(180,35,24,.07); border:1px solid rgba(180,35,24,.15);
          color:#b42318; font-size:12.5px; font-weight:600;
        }
        .sch-alert ul{ margin:4px 0 0; padding-left:15px; font-weight:500; }
        .sch-muted{ margin:0; padding:8px; font-size:12.5px; font-weight:500; color:var(--color-graphite,#707070); }

        .sch-foot{
          flex:0 0 auto;
          display:flex; align-items:center; gap:12px; flex-wrap:wrap;
          padding:15px 22px;
          border-top:1px solid rgba(29,29,31,.07);
          background:var(--color-snow,#fff);
        }
        .sch-total{ flex:1; min-width:0; font-size:12.5px; color:var(--color-graphite,#707070); }
        .sch-total b{ color:var(--color-ink,#1d1d1f); font-size:14px; font-variant-numeric:tabular-nums; }
        .sch-actions{ display:flex; align-items:center; gap:8px; }
        .sch-btn{
          display:inline-flex; align-items:center; gap:7px;
          height:38px; padding:0 17px; border-radius:999px; cursor:pointer;
          font-size:13.5px; font-weight:650;
          border:1px solid var(--color-silver-mist,#e8e8ed);
          background:var(--color-snow,#fff); color:var(--color-ink,#1d1d1f);
          transition:background 140ms ease-out, transform 110ms ease-out, opacity 140ms ease-out;
        }
        .sch-btn.is-primary{
          border-color:transparent; background:#0071e3; color:#fff;
        }
        /* Quiet by default - deleting is available, not advertised. The
           confirm step below is where it turns red. */
        .sch-btn.is-danger{ color:#b42318; border-color:rgba(180,35,24,.22); }
        .sch-btn:disabled{ opacity:.45; cursor:not-allowed; }
        .sch-btn:not(:disabled):active{ transform:scale(0.97); }

        .sch-total-inline{ flex:0 0 auto; margin-right:4px; }

        .sch-confirm{
          flex:1; min-width:0;
          display:flex; align-items:center; gap:8px; flex-wrap:wrap;
          font-size:12.5px; color:var(--color-graphite,#707070);
          animation:sch-in 180ms cubic-bezier(0.23,1,0.32,1) both;
        }
        .sch-confirm b{ color:#b42318; font-size:13px; font-weight:700; }
        .sch-confirm button{
          display:inline-flex; align-items:center; gap:6px;
          height:30px; padding:0 13px; border-radius:999px; cursor:pointer;
          font-size:12.5px; font-weight:650; font-family:inherit;
          border:1px solid var(--color-silver-mist,#e8e8ed);
          background:var(--color-snow,#fff); color:var(--color-ink,#1d1d1f);
          transition:opacity 140ms ease-out, transform 110ms ease-out;
        }
        .sch-confirm .sch-confirm-yes{ border-color:transparent; background:#b42318; color:#fff; }
        .sch-confirm button:disabled{ opacity:.45; cursor:not-allowed; }
        .sch-confirm button:not(:disabled):active{ transform:scale(0.97); }

        .sch-locked{
          display:flex; align-items:center; gap:9px; flex-wrap:wrap;
          padding:11px 14px; border-radius:14px;
          background:rgba(29,29,31,.035);
          border:1px solid rgba(29,29,31,.07);
          font-size:13.5px; font-weight:600; color:var(--color-ink,#1d1d1f);
        }
        .sch-locked em{
          font-style:normal; font-size:11.5px; font-weight:500;
          color:var(--color-graphite,#707070);
        }

        @keyframes sch-fade{ from{ opacity:0; } to{ opacity:1; } }
        @keyframes sch-pop{ from{ opacity:0; transform:scale(0.97); } to{ opacity:1; transform:none; } }
        @keyframes sch-in{ from{ opacity:0; transform:translateY(-3px); } to{ opacity:1; transform:none; } }
        .sch-reveal{ animation:sch-in 200ms cubic-bezier(0.23,1,0.32,1) both; }

        @media (hover:hover) and (pointer:fine){
          .sch-close:hover{ background:rgba(29,29,31,.1); }
          .sch-scope:not(:disabled):not(.is-active):hover{ border-color:rgba(29,29,31,.22); }
          .sch-result:not(:disabled):hover{ background:var(--color-snow,#fff); }
          .sch-step button:hover{ background:var(--color-fog,#f5f5f7); }
          .sch-remove:hover{ background:rgba(180,35,24,.09); color:#b42318; }
          .sch-btn:not(:disabled):hover{ opacity:.88; }
        }

        @media (max-width:600px){
          .sch-overlay{ padding:12px; }
          .sch-card{ max-height:calc(100vh - 24px); border-radius:22px; }
          .sch-scopes{ grid-template-columns:1fr; }
          .sch-scope{ flex-direction:row; align-items:center; gap:9px; }
          .sch-scope span{ flex:1; }
          .sch-body{ padding:18px; gap:18px; }
          .sch-foot{ padding:13px 18px; }
        }

        @media (prefers-reduced-motion: reduce){
          .sch-overlay, .sch-card, .sch-line, .sch-reveal{ animation:none; }
          .sch-close, .sch-scope, .sch-result, .sch-step button,
          .sch-remove, .sch-btn, .sch-search, .sch-input{ transition:none; }
          .sch-close:active, .sch-scope:active, .sch-step button:active,
          .sch-remove:active, .sch-btn:active{ transform:none; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
