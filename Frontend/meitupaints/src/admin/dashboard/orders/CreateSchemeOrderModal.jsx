import { useMemo, useState } from "react";

import {
  useCreateSchemeOrderMutation,
  useGetSchemeRecipientsQuery,
  useGetProductsQuery,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";
import AdminDecisionModal from "../components/AdminDecisionModal.jsx";
import { AppleDropdown } from "../../../components/dashboard/ApplePickers.jsx";
import { GhostButton, Pill } from "../../../components/dashboard/DashboardUI.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";

const fieldStyle = {
  width: "100%",
  height: 42,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid var(--color-silver-mist, #e8e8ed)",
  background: "var(--color-fog, #f5f5f7)",
  fontSize: 14.5,
  color: "var(--color-ink, #1d1d1f)",
};

const labelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".05em",
  textTransform: "uppercase",
  color: "var(--color-graphite, #707070)",
  marginBottom: 6,
};

export default function CreateSchemeOrderModal({ open, onClose, onCreated }) {
  const recipientsQuery = useGetSchemeRecipientsQuery(undefined, { skip: !open });
  const productsQuery = useGetProductsQuery(undefined, { skip: !open });
  const [createScheme, createState] = useCreateSchemeOrderMutation();

  const [recipientKey, setRecipientKey] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState([{ productId: "", quantity: "" }]);
  const [error, setError] = useState("");
  const [shortfalls, setShortfalls] = useState([]);

  const recipientOptions = useMemo(
    () =>
      (recipientsQuery.data || []).map((r) => ({
        key: r.key,
        label: `${r.name}${r.servedBy === "Dispatcher-served" ? "  ·  dispatcher-served" : ""}`,
      })),
    [recipientsQuery.data],
  );

  // Availability shown per product so the admin sees the ceiling before
  // submitting - creation is blocked server-side on shortfall, and a
  // silent rejection would be a poor way to learn that.
  const productOptions = useMemo(
    () =>
      (productsQuery.data || [])
        .filter((p) => p?.isActive !== false)
        .map((p) => {
          const available = Math.max(
            0,
            Number(p.stock?.currentQuantity || 0) - Number(p.stock?.reservedQuantity || 0),
          );
          return {
            key: String(p._id),
            label: `${p.name}${p.pack?.label ? ` · ${p.pack.label}` : ""}  —  ${available} available`,
            available,
          };
        }),
    [productsQuery.data],
  );

  const availableById = useMemo(
    () => new Map(productOptions.map((o) => [o.key, o.available])),
    [productOptions],
  );

  function reset() {
    setRecipientKey("");
    setLabel("");
    setNote("");
    setLines([{ productId: "", quantity: "" }]);
    setError("");
    setShortfalls([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function updateLine(index, patch) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  const validLines = lines.filter((l) => l.productId && Number(l.quantity) > 0);
  const [recipientType, recipientId] = recipientKey ? recipientKey.split(":") : ["", ""];
  const totalUnits = validLines.reduce((sum, l) => sum + Number(l.quantity || 0), 0);

  async function handleSubmit() {
    setError("");
    setShortfalls([]);
    if (!recipientId) return setError("Choose who receives this scheme.");
    if (!validLines.length) return setError("Add at least one product with a quantity.");

    try {
      await createScheme({
        recipientType,
        recipientId,
        label: label.trim(),
        note: note.trim(),
        items: validLines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
      }).unwrap();
      onCreated?.();
      reset();
      onClose();
    } catch (err) {
      const details = err?.data?.details;
      if (details?.code === "SCHEME_STOCK_SHORTFALL") {
        setShortfalls(details.shortfalls || []);
        setError("Not enough factory stock — reduce these quantities:");
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
      subtitle="Free-of-cost goods shipped direct from the factory. Enters the factory queue already verified, with stock reserved."
      confirmLabel={createState.isLoading ? "Creating…" : "Create scheme order"}
      busy={createState.isLoading}
      disabled={!recipientId || !validLines.length}
      onClose={handleClose}
      onConfirm={handleSubmit}
    >
      <div style={{ display: "grid", gap: 14 }}>
        {error ? (
          <div
            style={{
              padding: "11px 13px",
              borderRadius: 12,
              background: "rgba(180,35,24,.07)",
              border: "1px solid rgba(180,35,24,.16)",
              color: "#b42318",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <div>{error}</div>
            {shortfalls.length ? (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontWeight: 500 }}>
                {shortfalls.map((s) => (
                  <li key={s.productId}>
                    {s.name}: asked {s.requested}, only {s.available} available
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div>
          <span style={labelStyle}>Recipient</span>
          <AppleDropdown
            value={recipientKey}
            options={recipientOptions}
            onChange={setRecipientKey}
            placeholder={recipientsQuery.isLoading ? "Loading…" : "Select dealer or dispatcher"}
            icon="store"
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <span style={labelStyle}>Scheme name</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Dashain 2083 Volume Scheme"
            style={fieldStyle}
          />
        </div>

        <div>
          <span style={labelStyle}>Products (free of cost)</span>
          <div style={{ display: "grid", gap: 8 }}>
            {lines.map((line, index) => (
              <div
                key={index}
                className="scheme-line"
                style={{ display: "grid", gridTemplateColumns: "1fr 96px 36px", gap: 8 }}
              >
                <AppleDropdown
                  value={line.productId}
                  options={productOptions}
                  onChange={(value) => updateLine(index, { productId: value })}
                  placeholder={productsQuery.isLoading ? "Loading…" : "Select product"}
                  icon="package"
                  style={{ width: "100%" }}
                />
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={line.quantity}
                  onChange={(e) => updateLine(index, { quantity: e.target.value })}
                  placeholder="Qty"
                  style={{
                    ...fieldStyle,
                    borderColor:
                      line.productId && Number(line.quantity) > (availableById.get(line.productId) ?? Infinity)
                        ? "#b42318"
                        : fieldStyle.border,
                  }}
                />
                <button
                  type="button"
                  aria-label="Remove line"
                  onClick={() => setLines((c) => (c.length === 1 ? c : c.filter((_, i) => i !== index)))}
                  style={{
                    height: 42,
                    borderRadius: 12,
                    border: "1px solid var(--color-silver-mist, #e8e8ed)",
                    background: "transparent",
                    color: "var(--color-graphite, #707070)",
                    cursor: lines.length === 1 ? "not-allowed" : "pointer",
                    opacity: lines.length === 1 ? 0.4 : 1,
                  }}
                >
                  <DashboardIcon name="close" size={12} strokeWidth={2.4} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            <GhostButton icon="plus" onClick={() => setLines((c) => [...c, { productId: "", quantity: "" }])}>
              Add product
            </GhostButton>
          </div>
        </div>

        <div>
          <span style={labelStyle}>Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this scheme was granted"
            style={fieldStyle}
          />
        </div>

        {validLines.length ? (
          <div
            className="scheme-summary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 13px",
              borderRadius: 12,
              background: "var(--color-fog, #f5f5f7)",
              fontSize: 13,
              color: "var(--color-graphite, #707070)",
            }}
          >
            <Pill tone="accent" size="small">
              SCHEME
            </Pill>
            <span>
              {validLines.length} product{validLines.length === 1 ? "" : "s"} · {totalUnits} units · NPR 0
            </span>
          </div>
        ) : null}
      </div>

      <style>{`
        /* One-shot entrance for a newly added product row. Keyframe (not
           a transition) because it only ever plays once per mount. */
        .scheme-line{
          animation: scheme-line-in 220ms cubic-bezier(0.23, 1, 0.32, 1) both;
        }
        @keyframes scheme-line-in{
          from{ opacity:0; transform:translateY(-4px); }
          to{ opacity:1; transform:none; }
        }

        /* The running summary re-renders on every keystroke, so it gets a
           transition rather than an animation - a keyframe would restart
           mid-flight and flicker as the admin types quantities. */
        .scheme-summary{
          animation: scheme-summary-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both;
        }
        @keyframes scheme-summary-in{
          from{ opacity:0; transform:scale(0.98); }
          to{ opacity:1; transform:none; }
        }

        .scheme-line input,
        .scheme-line button{
          transition: border-color 150ms ease-out, background 150ms ease-out, transform 120ms ease-out;
        }
        .scheme-line button:active{ transform:scale(0.94); }
        .scheme-line input:focus{
          outline:none;
          border-color: var(--color-azure, #0071e3);
          background: var(--color-snow, #fff);
        }

        @media (hover:hover) and (pointer:fine){
          .scheme-line button:hover{ background: var(--color-fog, #f5f5f7); }
        }

        @media (prefers-reduced-motion: reduce){
          .scheme-line, .scheme-summary{ animation:none; }
          .scheme-line input, .scheme-line button{ transition:none; }
          .scheme-line button:active{ transform:none; }
        }
      `}</style>
    </AdminDecisionModal>
  );
}
