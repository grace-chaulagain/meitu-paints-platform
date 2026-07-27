import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../auth/AuthProvider.jsx";
import {
  DashboardUIStyles,
  EmptyState,
  GhostButton,
  Pill,
  PrimaryButton,
  RowCheckbox,
  SearchField,
  SectionHeader,
  SegmentedControl,
  Spinner,
  Surface,
} from "../../../components/dashboard/DashboardUI.jsx";
import { DashboardIcon } from "../../../components/dashboard/DashboardIcons.jsx";
import RichTextEditor from "../../../components/ui/RichTextEditor.jsx";
import AdminDecisionModal from "../components/AdminDecisionModal.jsx";
import {
  useGetAdminAnnouncementsQuery,
  useGetAdminDealersQuery,
  useGetAdminDispatchersQuery,
  usePreviewAnnouncementEmailMutation,
  useSendAdminAnnouncementMutation,
} from "../../../redux/api/meituApi.js";
import { getQueryErrorMessage } from "../../../redux/api/selectors.js";

const AUDIENCE_OPTIONS = [
  { key: "DEALERS", label: "Dealers" },
  { key: "DISPATCHERS", label: "Dispatchers" },
  { key: "BOTH", label: "Both" },
];

const RECIPIENT_MODE_OPTIONS = [
  { key: "ALL", label: "All verified" },
  { key: "SELECTED", label: "Choose specific" },
];

function dealerLabel(dealer) {
  return dealer.companyName || dealer.contactName || dealer.email || "Dealer";
}

function dispatcherLabel(dispatcher) {
  return dispatcher.companyName || dispatcher.name || dispatcher.email || "Dispatcher";
}

function RecipientChecklist({ title, items, selectedIds, onToggle, onToggleAll, search, onSearchChange, labelFor }) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => labelFor(item).toLowerCase().includes(q) || String(item.email || "").toLowerCase().includes(q));
  }, [items, search, labelFor]);

  const filteredIds = useMemo(() => filtered.map((item) => item._id), [filtered]);
  const selectedInFiltered = filteredIds.filter((id) => selectedIds.has(id)).length;
  const allFilteredSelected = filteredIds.length > 0 && selectedInFiltered === filteredIds.length;
  const someFilteredSelected = selectedInFiltered > 0 && !allFilteredSelected;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{title}</div>
        <Pill size="small">{selectedIds.size} selected</Pill>
      </div>
      <SearchField value={search} onChange={onSearchChange} placeholder={`Search ${title.toLowerCase()}...`} />
      {filteredIds.length > 0 ? (
        // Plain div, not a <button>: RowCheckbox already renders its own
        // <button role="checkbox">, and nesting a button inside a button
        // is invalid HTML (React 19 flags it as a hydration error).
        <div
          role="button"
          tabIndex={0}
          onClick={() => onToggleAll(filteredIds, !allFilteredSelected)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggleAll(filteredIds, !allFilteredSelected);
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px",
            marginTop: -4,
            borderRadius: 8,
            cursor: "pointer",
            alignSelf: "start",
          }}
        >
          <RowCheckbox
            checked={allFilteredSelected}
            indeterminate={someFilteredSelected}
            onChange={() => onToggleAll(filteredIds, !allFilteredSelected)}
            label={`Select all ${title.toLowerCase()}`}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-azure, #0071e3)" }}>
            {allFilteredSelected ? "All selected" : search.trim() ? `Select all ${filteredIds.length} matching` : `Select all ${filteredIds.length}`}
          </span>
        </div>
      ) : null}
      <div style={{ maxHeight: 220, overflowY: "auto", display: "grid", gap: 2, border: "1px solid rgba(232,232,237,.9)", borderRadius: 14, padding: 6 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 14, fontSize: 12.5, color: "var(--color-graphite, #707070)", textAlign: "center" }}>No matches.</div>
        ) : (
          filtered.map((item) => {
            const checked = selectedIds.has(item._id);
            return (
              // A row-level <button> here would nest RowCheckbox's own
              // <button role="checkbox"> inside it, which is invalid HTML
              // (React 19 flags it as a hydration error) - a plain
              // interactive div with a keyboard handler covers "click
              // anywhere in the row" without that nesting.
              <div
                key={item._id}
                role="button"
                tabIndex={0}
                onClick={() => onToggle(item._id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onToggle(item._id);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: checked ? "rgba(0,113,227,.08)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <RowCheckbox checked={checked} onChange={() => onToggle(item._id)} label={`Select ${labelFor(item)}`} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {labelFor(item)}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--color-graphite, #707070)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.email}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function statusPillTone(status) {
  if (status === "SENT") return "positive";
  if (status === "FAILED") return "critical";
  return "neutral";
}

function AnnouncementHistoryRow({ item }) {
  const [expanded, setExpanded] = useState(false);
  const total = item.recipients?.length || 0;
  const failed = (item.recipients || []).filter((r) => r.status === "FAILED").length;

  return (
    <div style={{ borderBottom: "1px solid rgba(232,232,237,.9)", padding: "14px 2px" }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-ink, #1d1d1f)" }}>{item.subject}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "var(--color-graphite, #707070)" }}>
            {new Date(item.createdAt).toLocaleString()} · {item.audience === "BOTH" ? "Dealers & Dispatchers" : item.audience === "DEALERS" ? "Dealers" : "Dispatchers"} · {item.recipientMode === "ALL" ? "All verified" : "Selected"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Pill size="small" tone={failed ? "critical" : "positive"}>
            {total - failed}/{total} sent
          </Pill>
          <DashboardIcon name="chevron" size={13} strokeWidth={2} style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 140ms ease-out" }} />
        </div>
      </button>
      {expanded ? (
        <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
          {(item.recipients || []).map((recipient) => (
            <div key={`${recipient.role}-${recipient.refId}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12.5, padding: "4px 0" }}>
              <span style={{ color: "var(--color-ink, #1d1d1f)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {recipient.name} <span style={{ color: "var(--color-graphite, #707070)", fontWeight: 500 }}>· {recipient.email}</span>
              </span>
              <Pill size="small" tone={statusPillTone(recipient.status)}>{recipient.status}</Pill>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminAnnouncementsPage() {
  const { user } = useAuth();

  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [audience, setAudience] = useState("DEALERS");
  const [recipientMode, setRecipientMode] = useState("ALL");
  const [selectedDealerIds, setSelectedDealerIds] = useState(() => new Set());
  const [selectedDispatcherIds, setSelectedDispatcherIds] = useState(() => new Set());
  const [dealerSearch, setDealerSearch] = useState("");
  const [dispatcherSearch, setDispatcherSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [composerKey, setComposerKey] = useState(0);
  const [resultBanner, setResultBanner] = useState(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const dealersQuery = useGetAdminDealersQuery({ status: "VERIFIED", limit: 1000 });
  const dispatchersQuery = useGetAdminDispatchersQuery({ status: "VERIFIED", limit: 100 });
  const historyQuery = useGetAdminAnnouncementsQuery({ limit: 20 });
  const [sendAnnouncement, sendState] = useSendAdminAnnouncementMutation();
  const [previewAnnouncement] = usePreviewAnnouncementEmailMutation();

  const dealers = dealersQuery.data?.items || [];
  const dispatchers = dispatchersQuery.data?.items || [];
  const history = historyQuery.data?.items || [];

  const recipientCount = useMemo(() => {
    const includeDealers = audience === "DEALERS" || audience === "BOTH";
    const includeDispatchers = audience === "DISPATCHERS" || audience === "BOTH";
    const dealerCount = includeDealers ? (recipientMode === "ALL" ? dealers.length : selectedDealerIds.size) : 0;
    const dispatcherCount = includeDispatchers ? (recipientMode === "ALL" ? dispatchers.length : selectedDispatcherIds.size) : 0;
    return dealerCount + dispatcherCount;
  }, [audience, recipientMode, dealers.length, dispatchers.length, selectedDealerIds, selectedDispatcherIds]);

  const canSend = subject.trim() && bodyHtml.trim() && recipientCount > 0 && !sendState.isLoading;

  // Debounced live preview - keeps the iframe byte-identical to the real
  // send without duplicating the shared shell's rendering logic in JS.
  // The controller responds { ok, item: { html } } - item.html, not html
  // directly off the mutation result.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!subject.trim() && !bodyHtml.trim()) {
        setPreviewHtml("");
        return;
      }
      setPreviewLoading(true);
      previewAnnouncement({ subject: subject || "(No subject)", bodyHtml, recipientName: "Sample Dealer" })
        .unwrap()
        .then((res) => setPreviewHtml(res?.item?.html || ""))
        .catch(() => {})
        .finally(() => setPreviewLoading(false));
    }, 400);
    return () => clearTimeout(timeout);
  }, [subject, bodyHtml, previewAnnouncement]);

  function toggleDealer(id) {
    setSelectedDealerIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDispatcher(id) {
    setSelectedDispatcherIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Applies to whatever's currently visible (search-filtered), not the
  // full list - matches the "select all matching" convention (Gmail,
  // etc.) so a filtered search doesn't silently select rows the admin
  // can't currently see.
  function toggleAllDealers(ids, select) {
    setSelectedDealerIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => (select ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  function toggleAllDispatchers(ids, select) {
    setSelectedDispatcherIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => (select ? next.add(id) : next.delete(id)));
      return next;
    });
  }

  async function handleConfirmSend() {
    try {
      const result = await sendAnnouncement({
        subject: subject.trim(),
        bodyHtml,
        audience,
        recipientMode,
        dealerIds: Array.from(selectedDealerIds),
        dispatcherIds: Array.from(selectedDispatcherIds),
      }).unwrap();

      setResultBanner({
        tone: result.failureCount ? "warning" : "success",
        message: `Sent to ${result.successCount}/${result.totalRecipients} recipient${result.totalRecipients === 1 ? "" : "s"}.`,
      });
      setConfirmOpen(false);
      setConfirmationText("");
      setSubject("");
      setBodyHtml("");
      setComposerKey((key) => key + 1);
      setSelectedDealerIds(new Set());
      setSelectedDispatcherIds(new Set());
    } catch (error) {
      setResultBanner({ tone: "critical", message: getQueryErrorMessage(error, "Failed to send announcement.") });
      setConfirmOpen(false);
      setConfirmationText("");
    }
  }

  const audienceLabel = audience === "BOTH" ? "Dealers & Dispatchers" : audience === "DEALERS" ? "Dealers" : "Dispatchers";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <DashboardUIStyles />
      <SectionHeader
        icon="bell"
        title="Announcements"
        subtitle="Notify dealers and dispatchers about company updates, pricing changes, or announcements."
      />

      {resultBanner ? (
        <Surface padding={16} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Pill tone={resultBanner.tone === "critical" ? "critical" : resultBanner.tone === "warning" ? "caution" : "positive"}>
              {resultBanner.tone === "critical" ? "Failed" : "Sent"}
            </Pill>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-ink, #1d1d1f)" }}>{resultBanner.message}</span>
          </div>
          <GhostButton onClick={() => setResultBanner(null)}>Dismiss</GhostButton>
        </Surface>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,0.85fr)", gap: 16, alignItems: "start" }} className="announcements-grid">
        <Surface padding={22} style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-graphite, #707070)", textTransform: "uppercase", letterSpacing: ".04em" }}>Subject</label>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. Updated pricing effective August 1"
              style={{
                height: 44,
                borderRadius: 14,
                border: "1px solid rgba(232,232,237,.9)",
                padding: "0 16px",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--color-ink, #1d1d1f)",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-graphite, #707070)", textTransform: "uppercase", letterSpacing: ".04em" }}>Message</label>
            <RichTextEditor key={composerKey} value={bodyHtml} onChange={setBodyHtml} />
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-graphite, #707070)", textTransform: "uppercase", letterSpacing: ".04em" }}>Audience</label>
            <SegmentedControl options={AUDIENCE_OPTIONS} value={audience} onChange={setAudience} />
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--color-graphite, #707070)", textTransform: "uppercase", letterSpacing: ".04em" }}>Recipients</label>
            <SegmentedControl options={RECIPIENT_MODE_OPTIONS} value={recipientMode} onChange={setRecipientMode} />
          </div>

          {recipientMode === "SELECTED" ? (
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: audience === "BOTH" ? "1fr 1fr" : "1fr" }} className="announcements-checklists">
              {audience === "DEALERS" || audience === "BOTH" ? (
                <RecipientChecklist
                  title="Dealers"
                  items={dealers}
                  selectedIds={selectedDealerIds}
                  onToggle={toggleDealer}
                  onToggleAll={toggleAllDealers}
                  search={dealerSearch}
                  onSearchChange={setDealerSearch}
                  labelFor={dealerLabel}
                />
              ) : null}
              {audience === "DISPATCHERS" || audience === "BOTH" ? (
                <RecipientChecklist
                  title="Dispatchers"
                  items={dispatchers}
                  selectedIds={selectedDispatcherIds}
                  onToggle={toggleDispatcher}
                  onToggleAll={toggleAllDispatchers}
                  search={dispatcherSearch}
                  onSearchChange={setDispatcherSearch}
                  labelFor={dispatcherLabel}
                />
              ) : null}
            </div>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 4 }}>
            <div style={{ fontSize: 12.5, color: "var(--color-graphite, #707070)", fontWeight: 600 }}>
              {recipientCount} recipient{recipientCount === 1 ? "" : "s"} · {audienceLabel}
            </div>
            <PrimaryButton icon="bell" disabled={!canSend} onClick={() => setConfirmOpen(true)}>
              Send Announcement
            </PrimaryButton>
          </div>
        </Surface>

        <Surface padding={0} style={{ overflow: "hidden", position: "sticky", top: 16 }}>
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid rgba(232,232,237,.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-graphite, #707070)", textTransform: "uppercase", letterSpacing: ".04em" }}>
              Live Preview
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                fontWeight: 600,
                color: "var(--color-graphite, #707070)",
                opacity: previewLoading ? 1 : 0,
                transition: "opacity 160ms ease-out",
              }}
            >
              <Spinner size={11} color="#707070" />
              Updating…
            </div>
          </div>
          {previewHtml ? (
            <iframe
              title="Announcement email preview"
              srcDoc={previewHtml}
              style={{
                width: "100%",
                height: 560,
                border: "none",
                display: "block",
                opacity: previewLoading ? 0.55 : 1,
                transition: "opacity 160ms ease-out",
              }}
            />
          ) : (
            <div style={{ padding: 40 }}>
              <EmptyState icon="invoice" title="Nothing to preview yet" subtitle="Start writing a subject and message to see a live preview." />
            </div>
          )}
        </Surface>
      </div>

      <Surface padding={22} style={{ display: "grid", gap: 4 }}>
        <SectionHeader icon="history" title="Recent Announcements" subtitle="Every broadcast sent to the network, most recent first." />
        {historyQuery.isLoading ? (
          <div style={{ padding: 30, display: "grid", placeItems: "center" }}>
            <Spinner />
          </div>
        ) : history.length === 0 ? (
          <EmptyState icon="bell" title="No announcements yet" subtitle="Announcements you send will show up here." />
        ) : (
          <div>
            {history.map((item) => (
              <AnnouncementHistoryRow key={item._id} item={item} />
            ))}
          </div>
        )}
      </Surface>

      <AdminDecisionModal
        open={confirmOpen}
        title="Send this announcement?"
        subtitle="This sends a real email to every matched recipient immediately and cannot be undone."
        confirmLabel="Send"
        requireText="SEND"
        confirmationText={confirmationText}
        onConfirmationTextChange={setConfirmationText}
        busy={sendState.isLoading}
        details={[
          { label: "Subject", value: subject },
          { label: "Audience", value: audienceLabel },
          { label: "Recipients", value: `${recipientCount}` },
          { label: "Sending as", value: user?.email || "Admin" },
        ]}
        onClose={() => {
          if (sendState.isLoading) return;
          setConfirmOpen(false);
          setConfirmationText("");
        }}
        onConfirm={handleConfirmSend}
      />

      <style>{`
        @media (max-width: 980px) {
          .announcements-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 620px) {
          .announcements-checklists { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
