import { useMemo, useState } from "react";
import { useBulkUpdateStockMutation } from "../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../redux/api/selectors.js";
import { DashboardIcon } from "../../components/dashboard/DashboardIcons.jsx";
import { GhostButton, Pill, PrimaryButton, SectionHeader } from "../../components/dashboard/DashboardUI.jsx";
import { AppleDropdown } from "../../components/dashboard/ApplePickers.jsx";
import { Banner, CloseButton, ModalOverlay } from "../factoryUI.jsx";
import { STOCK_REASONS, fieldInputStyle } from "../factoryHelpers.js";

const REASON_OPTIONS = STOCK_REASONS.map((item) => ({ key: item, label: item }));

export default function FactoryBulkImportModal({ open, products, onClose }) {
  const [rows, setRows] = useState([]);
  const [reason, setReason] = useState("Stock Received");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [showFormatHelp, setShowFormatHelp] = useState(false);
  const [bulkUpdate, bulkState] = useBulkUpdateStockMutation();

  const productBySku = useMemo(() => {
    const map = new Map();
    (products || []).forEach((product) => map.set(String(product.sku || "").toLowerCase(), product));
    return map;
  }, [products]);

  async function parseFile(file) {
    setError("");
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      setError("CSV must include headers and at least one row.");
      return;
    }
    const headers = lines[0].split(",").map((item) => item.trim().toLowerCase());
    const skuIndex = headers.findIndex((item) => ["sku", "product_sku"].includes(item));
    const quantityIndex = headers.findIndex((item) =>
      ["newquantity", "new_quantity", "quantity", "stock", "currentstock", "current_stock"].includes(item),
    );
    if (skuIndex === -1 || quantityIndex === -1) {
      setError("CSV needs sku and newQuantity columns.");
      return;
    }
    const parsed = lines.slice(1).map((line) => {
      const cols = line.split(",").map((item) => item.trim());
      const sku = cols[skuIndex] || "";
      const product = productBySku.get(sku.toLowerCase());
      const oldQuantity = Number(product?.stock?.currentQuantity || 0);
      const newQuantity = Number(cols[quantityIndex] || 0);
      return {
        sku,
        productName: product?.name || "Not found",
        productId: product?.productId || product?._id || "",
        oldQuantity,
        newQuantity,
        delta: newQuantity - oldQuantity,
        valid: Boolean(product && Number.isFinite(newQuantity) && newQuantity >= 0),
      };
    });
    setRows(parsed);
  }

  async function confirm() {
    const validRows = rows.filter((row) => row.valid);
    if (!validRows.length) {
      setError("No valid rows to import.");
      return;
    }
    try {
      await bulkUpdate({
        reason,
        note,
        changes: validRows.map((row) => ({ productId: row.productId, sku: row.sku, newQuantity: row.newQuantity })),
      }).unwrap();
      setRows([]);
      setNote("");
      onClose();
    } catch (err) {
      setError(getQueryErrorMessage(err, "Bulk import failed."));
    }
  }

  return (
    <ModalOverlay open={open} onClose={onClose} maxWidth={760}>
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <SectionHeader
            icon="download"
            title="Import Stock from CSV"
            subtitle="Upload a CSV exported from Excel. Changes are previewed before stock is updated."
          />
          <CloseButton onClick={onClose} />
        </div>

        <button
          type="button"
          onClick={() => setShowFormatHelp((value) => !value)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", border: "none", background: "rgba(0,113,227,.08)", color: "var(--color-azure, #0071e3)", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          <DashboardIcon name="filter" size={12} strokeWidth={2} />
          {showFormatHelp ? "Hide accepted format" : "View accepted format"}
        </button>

        {showFormatHelp ? (
          <div style={{ padding: 14, borderRadius: 12, background: "var(--color-fog, #f5f5f7)", fontSize: 12.5 }}>
            <div style={{ fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>Header names are not case-sensitive.</div>
            <table style={{ marginTop: 10, width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontSize: 11, color: "var(--color-graphite, #707070)" }}>sku</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", fontSize: 11, color: "var(--color-graphite, #707070)" }}>newQuantity</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={{ padding: "4px 8px" }}>EXT-HIGH-GLOSS-20L</td><td style={{ padding: "4px 8px" }}>145</td></tr>
                <tr><td style={{ padding: "4px 8px" }}>ROLLER-10IN</td><td style={{ padding: "4px 8px" }}>32</td></tr>
              </tbody>
            </table>
            <div style={{ marginTop: 8, color: "var(--color-graphite, #707070)" }}>Also accepted: product_sku, quantity, stock, current_stock.</div>
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              gridColumn: "1 / -1",
              height: 90,
              borderRadius: 12,
              border: "1.5px dashed rgba(0,0,0,.14)",
              background: "var(--color-fog, #f5f5f7)",
              cursor: "pointer",
              position: "relative",
            }}
          >
            <DashboardIcon name="download" size={20} strokeWidth={1.8} style={{ color: "var(--color-graphite, #707070)" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>Choose CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) parseFile(file);
              }}
              style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
            />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Reason</span>
            <AppleDropdown value={reason} options={REASON_OPTIONS} onChange={setReason} />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-graphite, #707070)" }}>Note</span>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional import note" style={fieldInputStyle()} />
          </label>
        </div>

        {error ? <Banner tone="error">{error}</Banner> : null}

        {rows.length > 0 ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Pill tone="neutral" size="small">{rows.length} rows parsed</Pill>
              <Pill tone="positive" size="small">{rows.filter((row) => row.valid).length} ready</Pill>
              <Pill tone="critical" size="small">{rows.filter((row) => !row.valid).length} skipped</Pill>
            </div>
            <div style={{ borderRadius: 14, border: "1px solid rgba(0,0,0,.06)", maxHeight: 260, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--color-fog, #f5f5f7)" }}>
                    {["SKU", "Product", "Old", "New", "Diff", "Status"].map((head, index) => (
                      <th key={head} style={{ textAlign: index === 0 || index === 1 ? "left" : "right", padding: "8px 12px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--color-graphite, #707070)", position: "sticky", top: 0, background: "var(--color-fog, #f5f5f7)" }}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.sku}-${index}`} style={{ borderTop: "1px solid rgba(0,0,0,.06)", opacity: row.valid ? 1 : 0.5 }}>
                      <td style={{ padding: "7px 12px", fontSize: 12.5 }}>{row.sku}</td>
                      <td style={{ padding: "7px 12px", fontSize: 12.5 }}>{row.productName}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", fontSize: 12.5 }}>{row.oldQuantity}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", fontSize: 12.5 }}>{row.newQuantity}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", fontSize: 12.5 }}>{row.delta >= 0 ? `+${row.delta}` : row.delta}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right" }}>
                        <Pill tone={row.valid ? "positive" : "critical"} size="small">{row.valid ? "Ready" : "Skipped"}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <GhostButton onClick={() => setRows([])}>Clear Preview</GhostButton>
              <PrimaryButton icon="checkmark" onClick={confirm} disabled={bulkState.isLoading}>{bulkState.isLoading ? "Importing…" : "Confirm Import"}</PrimaryButton>
            </div>
          </div>
        ) : null}
      </div>
    </ModalOverlay>
  );
}
