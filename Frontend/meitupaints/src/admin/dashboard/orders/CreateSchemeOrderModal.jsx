import { useMemo, useState } from "react";

import {
  useCreateSchemeOrderMutation,
  useGetSchemeRecipientsQuery,
  useGetProductsQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import AdminDecisionModal from "../components/AdminDecisionModal.jsx";
import { AppleDropdown } from "../../../components/dashboard/ApplePickers.jsx";
import { Pill } from "../../../components/dashboard/DashboardUI.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";

// Master scope first, then the filtered name list. Mixing factory
// dealers, dispatcher-served dealers and dispatchers into one list made
// it impossible to tell what you were picking, and it grew unusable as
// the dealer count rose.
const SCOPES = [
  {
    key: "FACTORY_DEALERS",
    label: "Factory-routed dealers",
    icon: "store",
    hint: "Supplied directly by the factory",
  },
  {
    key: "DISPATCHER_DEALERS",
    label: "Dispatcher-routed dealers",
    icon: "handshake",
    hint: "Normally supplied by a dispatcher — schemes still ship direct from the factory",
  },
  {
    key: "DISPATCHERS",
    label: "Dispatchers",
    icon: "truck",
    hint: "The dispatcher's own regional stock",
  },
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

export default function CreateSchemeOrderModal({ open, onClose, onCreated }) {
  const recipientsQuery = useGetSchemeRecipientsQuery(undefined, { skip: !open });
  const [createScheme, createState] = useCreateSchemeOrderMutation();

  const [scope, setScope] = useState("");
  const [recipientKey, setRecipientKey] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [shortfalls, setShortfalls] = useState([]);

  const trimmed = query.trim();
  // Same server-side search the Amend Order card uses, so the catalog
  // behaves identically in both places.
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
    () =>
      recipients
        .filter((r) => matchesScope(r, scope))
        .map((r) => ({ key: r.key, label: r.name })),
    [recipients, scope],
  );

  const selectedRecipient = recipients.find((r) => r.key === recipientKey) || null;
  const [recipientType, recipientId] = recipientKey ? recipientKey.split(":") : ["", ""];
  const totalUnits = lines.reduce((sum, l) => sum + Number(l.quantity || 0), 0);

  function availableOf(product) {
    return Math.max(
      0,
      Number(product.stock?.currentQuantity || 0) - Number(product.stock?.reservedQuantity || 0),
    );
  }

  function addProduct(product) {
    setLines((current) => {
      if (current.some((l) => l.productId === String(product._id))) return current;
      return [
        ...current,
        {
          productId: String(product._id),
          name: product.name,
          packLabel: product.pack?.label || "",
          sku: product.sku,
          available: availableOf(product),
          quantity: 1,
        },
      ];
    });
    setQuery("");
  }

  function reset() {
    setScope("");
    setRecipientKey("");
    setLabel("");
    setNote("");
    setLines([]);
    setQuery("");
    setError("");
    setShortfalls([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  const overCapacity = lines.filter((l) => Number(l.quantity) > l.available);
  const canSubmit = Boolean(recipientId) && lines.length > 0 && overCapacity.length === 0;

  async function handleSubmit() {
    setError("");
    setShortfalls([]);
    if (!recipientId) return setError("Choose who receives this scheme.");
    if (!lines.length) return setError("Add at least one product.");

    try {
      await createScheme({
        recipientType,
        recipientId,
        label: label.trim(),
        note: note.trim(),
        items: lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
      }).unwrap();
      onCreated?.();
      reset();
      onClose();
    } catch (err) {
      const details = err?.data?.details;
      if (details?.code === "SCHEME_STOCK_SHORTFALL") {
        setShortfalls(details.shortfalls || []);
        setError("Factory stock moved while you were editing — reduce these:");
      } else {
        setError(getQueryErrorMessage(err, "Failed to create the scheme order."));
      }
    }
  }

  if (!open) return null;

  return (
    <AdminDecisionModal
      open={open}
      title="Create scheme order"
      subtitle="Free-of-cost goods, shipped direct from the factory."
      confirmLabel={createState.isLoading ? "Creating…" : "Create scheme order"}
      busy={createState.isLoading}
      disabled={!canSubmit}
      onClose={handleClose}
      onConfirm={handleSubmit}
    >
      <div className="scheme-form">
        {error ? (
          <div className="scheme-alert" role="alert">
            <DashboardIcon name="warning" size={15} strokeWidth={2} />
            <div>
              <div>{error}</div>
              {shortfalls.length ? (
                <ul>
                  {shortfalls.map((s) => (
                    <li key={s.productId}>
                      {s.name} — asked {s.requested}, {s.available} available
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Step 1 — scope */}
        <section className="scheme-step">
          <header>
            <span className="scheme-step-index">1</span>
            <div>
              <h4>Who is this for?</h4>
              <p>Pick the group first, then the name.</p>
            </div>
          </header>

          <div className="scheme-scopes">
            {SCOPES.map((s) => {
              const active = scope === s.key;
              const count = scopeCounts[s.key] ?? 0;
              return (
                <button
                  key={s.key}
                  type="button"
                  className={`scheme-scope ${active ? "is-active" : ""}`}
                  onClick={() => {
                    setScope(s.key);
                    setRecipientKey("");
                  }}
                  disabled={!count}
                  title={s.hint}
                >
                  <span className="scheme-scope-icon">
                    <DashboardIcon name={s.icon} size={17} strokeWidth={1.9} />
                  </span>
                  <span className="scheme-scope-text">
                    <strong>{s.label}</strong>
                    <small>{count} available</small>
                  </span>
                  <span className="scheme-scope-check" aria-hidden="true">
                    <DashboardIcon name="checkmark" size={13} strokeWidth={2.6} />
                  </span>
                </button>
              );
            })}
          </div>

          {scope ? (
            <div className="scheme-reveal">
              <AppleDropdown
                value={recipientKey}
                options={recipientOptions}
                onChange={setRecipientKey}
                placeholder={recipientsQuery.isLoading ? "Loading…" : "Select recipient"}
                icon="user"
                style={{ width: "100%" }}
              />
              {scope === "DISPATCHER_DEALERS" && selectedRecipient ? (
                <p className="scheme-inline-note">
                  <DashboardIcon name="info" size={12} strokeWidth={2} />
                  Ships direct from the factory, bypassing their dispatcher.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* Step 2 — products */}
        <section className="scheme-step">
          <header>
            <span className="scheme-step-index">2</span>
            <div>
              <h4>What are they receiving?</h4>
              <p>Search the catalog and add items.</p>
            </div>
          </header>

          <div className="scheme-search">
            <DashboardIcon name="search" size={15} strokeWidth={2} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by product name, SKU or code…"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                <DashboardIcon name="close" size={12} strokeWidth={2.4} />
              </button>
            ) : null}
          </div>

          {trimmed.length >= 2 ? (
            <div className="scheme-results scheme-reveal">
              {productsQuery.isFetching ? (
                <div className="scheme-muted">Searching…</div>
              ) : results.length === 0 ? (
                <div className="scheme-muted">No products match “{trimmed}”.</div>
              ) : (
                results.slice(0, 6).map((product) => {
                  const available = availableOf(product);
                  const added = lines.some((l) => l.productId === String(product._id));
                  return (
                    <button
                      key={product._id}
                      type="button"
                      className="scheme-result"
                      onClick={() => addProduct(product)}
                      disabled={added || available === 0}
                    >
                      <span className="scheme-result-main">
                        <strong>{product.name}</strong>
                        <small>
                          {product.pack?.label ? `${product.pack.label} · ` : ""}
                          {product.sku}
                        </small>
                      </span>
                      <span className={`scheme-stock ${available === 0 ? "is-none" : ""}`}>
                        {available === 0 ? "Out of stock" : `${available} available`}
                      </span>
                      <span className="scheme-result-add">
                        <DashboardIcon name={added ? "checkmark" : "plus"} size={13} strokeWidth={2.4} />
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          ) : null}

          {lines.length ? (
            <ul className="scheme-lines">
              {lines.map((line, index) => {
                const over = Number(line.quantity) > line.available;
                return (
                  <li key={line.productId} className={`scheme-line ${over ? "is-over" : ""}`}>
                    <span className="scheme-line-main">
                      <strong>{line.name}</strong>
                      <small>
                        {line.packLabel ? `${line.packLabel} · ` : ""}
                        {line.available} available
                      </small>
                    </span>

                    <span className="scheme-stepper">
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
                        <DashboardIcon name="minus" size={12} strokeWidth={2.6} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={line.quantity}
                        onChange={(e) =>
                          setLines((c) =>
                            c.map((l, i) => (i === index ? { ...l, quantity: e.target.value } : l)),
                          )
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
                        <DashboardIcon name="plus" size={12} strokeWidth={2.6} />
                      </button>
                    </span>

                    <button
                      type="button"
                      className="scheme-line-remove"
                      aria-label={`Remove ${line.name}`}
                      onClick={() => setLines((c) => c.filter((_, i) => i !== index))}
                    >
                      <DashboardIcon name="trash" size={13} strokeWidth={2} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="scheme-empty">
              <DashboardIcon name="package" size={20} strokeWidth={1.6} />
              <span>No products yet — search above to add them.</span>
            </div>
          )}
        </section>

        {/* Step 3 — label */}
        <section className="scheme-step">
          <header>
            <span className="scheme-step-index">3</span>
            <div>
              <h4>Label it</h4>
              <p>So this shows as a campaign, not an anonymous free order.</p>
            </div>
          </header>

          <div className="scheme-fields">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Scheme name — e.g. Dashain 2083 Volume Scheme"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
            />
          </div>
        </section>

        {lines.length ? (
          <footer className="scheme-summary scheme-reveal">
            <Pill tone="caution" size="small">
              SCHEME
            </Pill>
            <span className="scheme-summary-text">
              {selectedRecipient ? <strong>{selectedRecipient.name}</strong> : "No recipient yet"} ·{" "}
              {lines.length} product{lines.length === 1 ? "" : "s"} · {totalUnits} units
            </span>
            <span className="scheme-summary-cost">NPR 0</span>
          </footer>
        ) : null}
      </div>

      <style>{`
        .scheme-form{ display:grid; gap:18px; }

        .scheme-step{ display:grid; gap:11px; }
        .scheme-step > header{ display:flex; align-items:flex-start; gap:10px; }
        .scheme-step-index{
          flex:0 0 auto;
          width:21px; height:21px; border-radius:999px;
          display:grid; place-items:center;
          background:var(--color-ink, #1d1d1f); color:#fff;
          font-size:11px; font-weight:700;
        }
        .scheme-step h4{
          margin:0; font-size:14px; font-weight:700; letter-spacing:-.01em;
          color:var(--color-ink, #1d1d1f);
        }
        .scheme-step p{
          margin:2px 0 0; font-size:12.5px; font-weight:500;
          color:var(--color-graphite, #707070);
        }

        /* Scope cards - a real choice, so they read as options rather
           than another select. Collapses to one column on narrow screens. */
        .scheme-scopes{ display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; }
        .scheme-scope{
          position:relative;
          display:flex; align-items:center; gap:9px;
          padding:11px 12px; text-align:left;
          border-radius:14px;
          border:1.5px solid var(--color-silver-mist, #e8e8ed);
          background:var(--color-snow, #fff);
          cursor:pointer;
          transition:border-color 150ms ease-out, background 150ms ease-out, transform 120ms ease-out;
        }
        .scheme-scope:disabled{ opacity:.45; cursor:not-allowed; }
        .scheme-scope:not(:disabled):active{ transform:scale(0.98); }
        .scheme-scope.is-active{
          border-color:var(--color-azure, #0071e3);
          background:color-mix(in srgb, var(--color-azure, #0071e3) 5%, transparent);
        }
        .scheme-scope-icon{
          flex:0 0 auto; width:30px; height:30px; border-radius:9px;
          display:grid; place-items:center;
          background:var(--color-fog, #f5f5f7);
          color:var(--color-slate, #474747);
        }
        .scheme-scope.is-active .scheme-scope-icon{
          background:var(--color-azure, #0071e3); color:#fff;
        }
        .scheme-scope-text{ display:grid; min-width:0; }
        .scheme-scope-text strong{
          font-size:12.5px; font-weight:650; color:var(--color-ink, #1d1d1f);
          line-height:1.25;
        }
        .scheme-scope-text small{ font-size:11px; color:var(--color-graphite, #707070); }
        .scheme-scope-check{
          position:absolute; top:8px; right:9px;
          color:var(--color-azure, #0071e3);
          opacity:0; transform:scale(0.7);
          transition:opacity 160ms ease-out, transform 160ms cubic-bezier(0.34,1.56,0.64,1);
        }
        .scheme-scope.is-active .scheme-scope-check{ opacity:1; transform:scale(1); }

        /* Search */
        .scheme-search{
          display:flex; align-items:center; gap:9px;
          height:42px; padding:0 12px;
          border-radius:13px;
          background:var(--color-fog, #f5f5f7);
          border:1.5px solid transparent;
          color:var(--color-graphite, #707070);
          transition:border-color 150ms ease-out, background 150ms ease-out;
        }
        .scheme-search:focus-within{
          border-color:var(--color-azure, #0071e3);
          background:var(--color-snow, #fff);
        }
        .scheme-search input{
          flex:1; min-width:0; border:none; background:transparent; outline:none;
          font-size:14px; color:var(--color-ink, #1d1d1f);
        }
        .scheme-search > button{
          border:none; background:transparent; cursor:pointer; padding:4px;
          color:var(--color-graphite, #707070); display:grid; place-items:center;
        }

        .scheme-results{
          display:grid; gap:4px;
          padding:5px;
          border-radius:13px;
          background:var(--color-fog, #f5f5f7);
        }
        .scheme-result{
          display:flex; align-items:center; gap:10px;
          padding:9px 10px; border-radius:10px;
          border:none; background:transparent; cursor:pointer; text-align:left;
          transition:background 130ms ease-out, transform 120ms ease-out;
        }
        .scheme-result:disabled{ opacity:.5; cursor:not-allowed; }
        .scheme-result:not(:disabled):active{ transform:scale(0.99); }
        .scheme-result-main{ display:grid; min-width:0; flex:1; }
        .scheme-result-main strong{
          font-size:13px; font-weight:600; color:var(--color-ink, #1d1d1f);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .scheme-result-main small{ font-size:11.5px; color:var(--color-graphite, #707070); }
        .scheme-stock{
          flex:0 0 auto; font-size:11.5px; font-weight:600;
          color:var(--color-graphite, #707070);
        }
        .scheme-stock.is-none{ color:#b42318; }
        .scheme-result-add{
          flex:0 0 auto; width:24px; height:24px; border-radius:999px;
          display:grid; place-items:center;
          background:var(--color-snow, #fff); color:var(--color-azure, #0071e3);
        }

        /* Chosen lines */
        .scheme-lines{ list-style:none; margin:0; padding:0; display:grid; gap:7px; }
        .scheme-line{
          display:flex; align-items:center; gap:10px;
          padding:9px 10px 9px 12px;
          border-radius:13px;
          border:1.5px solid var(--color-silver-mist, #e8e8ed);
          background:var(--color-snow, #fff);
          animation:scheme-in 200ms cubic-bezier(0.23,1,0.32,1) both;
        }
        .scheme-line.is-over{ border-color:#b42318; background:rgba(180,35,24,.04); }
        .scheme-line-main{ display:grid; min-width:0; flex:1; }
        .scheme-line-main strong{
          font-size:13px; font-weight:600; color:var(--color-ink, #1d1d1f);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .scheme-line-main small{ font-size:11.5px; color:var(--color-graphite, #707070); }

        .scheme-stepper{
          flex:0 0 auto; display:flex; align-items:center; gap:2px;
          padding:2px; border-radius:999px; background:var(--color-fog, #f5f5f7);
        }
        .scheme-stepper button{
          width:26px; height:26px; border-radius:999px;
          border:none; background:transparent; cursor:pointer;
          display:grid; place-items:center; color:var(--color-ink, #1d1d1f);
          transition:background 130ms ease-out, transform 110ms ease-out;
        }
        .scheme-stepper button:active{ transform:scale(0.9); }
        .scheme-stepper input{
          width:38px; text-align:center; border:none; background:transparent;
          outline:none; font-size:13px; font-weight:700;
          color:var(--color-ink, #1d1d1f);
          font-variant-numeric:tabular-nums;
          -moz-appearance:textfield;
        }
        .scheme-stepper input::-webkit-outer-spin-button,
        .scheme-stepper input::-webkit-inner-spin-button{ -webkit-appearance:none; margin:0; }

        .scheme-line-remove{
          flex:0 0 auto; width:28px; height:28px; border-radius:999px;
          border:none; background:transparent; cursor:pointer;
          display:grid; place-items:center; color:var(--color-graphite, #707070);
          transition:background 130ms ease-out, color 130ms ease-out, transform 110ms ease-out;
        }
        .scheme-line-remove:active{ transform:scale(0.9); }

        .scheme-empty{
          display:flex; align-items:center; justify-content:center; gap:9px;
          padding:20px; border-radius:13px;
          border:1.5px dashed var(--color-silver-mist, #e8e8ed);
          color:var(--color-graphite, #707070);
          font-size:12.5px; font-weight:500;
        }

        .scheme-fields{ display:grid; gap:8px; }
        .scheme-fields input{
          height:42px; padding:0 12px; border-radius:13px;
          border:1.5px solid transparent; background:var(--color-fog, #f5f5f7);
          font-size:14px; color:var(--color-ink, #1d1d1f); outline:none;
          transition:border-color 150ms ease-out, background 150ms ease-out;
        }
        .scheme-fields input:focus{
          border-color:var(--color-azure, #0071e3); background:var(--color-snow, #fff);
        }

        .scheme-summary{
          display:flex; align-items:center; gap:9px; flex-wrap:wrap;
          padding:11px 13px; border-radius:14px;
          background:var(--color-fog, #f5f5f7);
        }
        .scheme-summary-text{ font-size:12.5px; color:var(--color-graphite, #707070); }
        .scheme-summary-text strong{ color:var(--color-ink, #1d1d1f); font-weight:650; }
        .scheme-summary-cost{
          margin-left:auto; font-size:14px; font-weight:700;
          color:var(--color-ink, #1d1d1f); font-variant-numeric:tabular-nums;
        }

        .scheme-alert{
          display:flex; align-items:flex-start; gap:9px;
          padding:11px 13px; border-radius:13px;
          background:rgba(180,35,24,.07); border:1px solid rgba(180,35,24,.16);
          color:#b42318; font-size:12.5px; font-weight:600;
        }
        .scheme-alert ul{ margin:5px 0 0; padding-left:16px; font-weight:500; }

        .scheme-inline-note{
          display:flex; align-items:center; gap:6px;
          margin:8px 0 0; font-size:11.5px; font-weight:500;
          color:var(--color-graphite, #707070);
        }
        .scheme-muted{
          padding:10px; font-size:12.5px; font-weight:500;
          color:var(--color-graphite, #707070);
        }

        /* One shared entrance for anything that appears on a choice. */
        .scheme-reveal{ animation:scheme-in 220ms cubic-bezier(0.23,1,0.32,1) both; }
        @keyframes scheme-in{
          from{ opacity:0; transform:translateY(-4px); }
          to{ opacity:1; transform:none; }
        }

        @media (hover:hover) and (pointer:fine){
          .scheme-scope:not(:disabled):not(.is-active):hover{ border-color:rgba(29,29,31,.2); }
          .scheme-result:not(:disabled):hover{ background:var(--color-snow, #fff); }
          .scheme-stepper button:hover{ background:var(--color-snow, #fff); }
          .scheme-line-remove:hover{ background:rgba(180,35,24,.08); color:#b42318; }
        }

        /* Narrow screens: scopes stack, and each line's controls wrap
           under its name rather than squeezing into an unusable row. */
        @media (max-width:620px){
          .scheme-scopes{ grid-template-columns:1fr; }
          .scheme-line{ flex-wrap:wrap; }
          .scheme-line-main{ flex:1 1 100%; }
          .scheme-stepper{ margin-left:auto; }
        }

        @media (prefers-reduced-motion: reduce){
          .scheme-reveal, .scheme-line{ animation:none; }
          .scheme-scope, .scheme-result, .scheme-stepper button,
          .scheme-line-remove, .scheme-search, .scheme-fields input{ transition:none; }
          .scheme-scope:active, .scheme-result:active,
          .scheme-stepper button:active, .scheme-line-remove:active{ transform:none; }
          .scheme-scope-check{ transition:none; }
        }
      `}</style>
    </AdminDecisionModal>
  );
}
