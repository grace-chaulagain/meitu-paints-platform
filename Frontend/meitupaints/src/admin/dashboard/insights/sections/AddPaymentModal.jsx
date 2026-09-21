import { useMemo, useState } from "react";

import {
  useCreateAdminPaymentMutation,
  useGetAdminAllocationPreviewQuery,
  useGetAdminPayablePartyListQuery,
} from "../../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../../redux/api/selectors.js";
import AdminDecisionModal from "../../components/AdminDecisionModal.jsx";
import { AppleDropdown } from "../../../../components/dashboard/ApplePickers.jsx";
import { money } from "../insightsFormatting.js";
import { CURRENCY } from "./sectionLayout.js";
import { ErrorBanner } from "./sectionShared.jsx";

const METHOD_OPTIONS = [
  { key: "CASH", label: "Cash" },
  { key: "ONLINE", label: "Online transfer" },
  { key: "CHEQUE", label: "Cheque" },
  { key: "BANK_GUARANTEE", label: "Bank guarantee" },
  { key: "CREDIT", label: "Credit" },
];

const fieldStyle = {
  width: "100%",
  height: 44,
  padding: "0 12px",
  borderRadius: 12,
  border: "1px solid var(--color-silver-mist, #e8e8ed)",
  background: "var(--color-fog, #f5f5f7)",
  fontSize: 15,
  color: "var(--color-ink, #1d1d1f)",
};

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: ".02em",
  textTransform: "uppercase",
  color: "var(--color-graphite, #707070)",
  marginBottom: 6,
};

export default function AddPaymentModal({ open, onClose, onRecorded }) {
  const partiesQuery = useGetAdminPayablePartyListQuery(undefined, { skip: !open });
  const [createPayment, createState] = useCreateAdminPaymentMutation();

  const [partyKey, setPartyKey] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  // Reset on the way out rather than in an effect keyed on `open`, so the
  // modal keeps its exit animation and always reopens clean.
  function resetForm() {
    setPartyKey("");
    setAmount("");
    setMethod("CASH");
    setNote("");
    setError("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  const partyOptions = useMemo(
    () => (partiesQuery.data || []).map((party) => ({ key: party.key, label: party.name })),
    [partiesQuery.data],
  );

  const [partyType, partyId] = partyKey ? partyKey.split(":") : ["", ""];
  const numericAmount = Number(amount) || 0;

  // Live preview of which bills this money will clear, so the admin sees
  // the allocation before committing rather than discovering it after.
  const previewQuery = useGetAdminAllocationPreviewQuery(
    { partyType, partyId, amount: numericAmount },
    { skip: !open || !partyId || numericAmount <= 0 },
  );
  const preview = previewQuery.data;

  async function handleSubmit() {
    setError("");
    if (!partyId) return setError("Choose who this payment is from.");
    if (numericAmount <= 0) return setError("Enter an amount greater than zero.");

    try {
      await createPayment({
        partyType,
        partyId,
        amount: numericAmount,
        method,
        note: note.trim(),
      }).unwrap();
      onRecorded?.();
      resetForm();
      onClose();
    } catch (err) {
      setError(getQueryErrorMessage(err, "Failed to record the payment."));
    }
  }

  if (!open) return null;

  return (
    <AdminDecisionModal
      open={open}
      title="Record a payment"
      subtitle="Factory-routed dealers and dispatchers only — dealers served by a dispatcher settle with that dispatcher."
      confirmLabel={createState.isLoading ? "Recording…" : "Record payment"}
      busy={createState.isLoading}
      disabled={!partyId || numericAmount <= 0}
      onClose={handleClose}
      onConfirm={handleSubmit}
    >
      <div style={{ display: "grid", gap: 14 }}>
        {error ? <ErrorBanner message={error} /> : null}

        <div>
          <span style={labelStyle}>From</span>
          <AppleDropdown
            value={partyKey}
            options={partyOptions}
            onChange={setPartyKey}
            placeholder={partiesQuery.isLoading ? "Loading…" : "Select dealer or dispatcher"}
            icon="store"
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <span style={labelStyle}>Amount ({CURRENCY})</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              style={fieldStyle}
            />
          </div>
          <div>
            <span style={labelStyle}>Method</span>
            <AppleDropdown
              value={method}
              options={METHOD_OPTIONS}
              onChange={setMethod}
              placeholder="Method"
              icon="invoice"
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div>
          <span style={labelStyle}>Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reference, cheque number, remarks…"
            style={fieldStyle}
          />
        </div>

        {preview ? (
          <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--color-fog, #f5f5f7)", display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>
              This payment will settle
            </div>
            {preview.allocations?.length ? (
              preview.allocations.map((allocation) => (
                <div key={allocation.orderId} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--color-ink, #1d1d1f)" }}>{allocation.orderNumber || "Order"}</span>
                  <span className="dash-table-tabular">{money(allocation.amount, CURRENCY)}</span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 13, color: "var(--color-graphite, #707070)" }}>
                Nothing outstanding — this will sit on account as credit.
              </div>
            )}
            {preview.unallocated > 0 ? (
              <div style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)" }}>
                {money(preview.unallocated, CURRENCY)} left on account as credit.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </AdminDecisionModal>
  );
}
