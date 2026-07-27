import { createContext, useContext } from "react";

export const READ_ONLY_ADMIN_ROLE = "READ_ONLY_ADMIN";
export const READ_ONLY_ADMIN_LOCK_TITLE = "Read-only admin: viewing only";

const ReadOnlyAdminContext = createContext(false);

const READ_ONLY_WRITE_RE = /\b(add|amend|approve|assign|activate|create|deactivate|delete|edit|generate|import|issue|mark|move|new|publish|reject|remove|replace|restore|save|send|settle|submit|suspend|unassign|update|upload|verify)\b/i;
const READ_ONLY_ALLOW_RE = /\b(archive|back|cancel|clear search|clear filter|clear filters|close|copy|download|export|filter|full order history|hide|history|logout|next|open|preview|previous|print|refresh|reset view|retry|search|select|show|sort|view)\b/i;

export function isReadOnlyAdminRole(role) {
  return String(role || "").toUpperCase() === READ_ONLY_ADMIN_ROLE;
}

export function isReadOnlyAdminUser(user) {
  return isReadOnlyAdminRole(user?.role);
}

export function ReadOnlyAdminProvider({ enabled = false, children }) {
  return (
    <ReadOnlyAdminContext.Provider value={Boolean(enabled)}>
      {children}
    </ReadOnlyAdminContext.Provider>
  );
}

export function ReadOnlyAdminStyles() {
  return (
    <style>{`
      body.admin-readonly-mode [data-readonly-write-action="true"],
      body.admin-readonly-mode .admin-readonly-action-locked{
        opacity:.42!important;
        filter:grayscale(.32) saturate(.55)!important;
        cursor:not-allowed!important;
        box-shadow:none!important;
      }

      body.admin-readonly-mode [data-readonly-write-action="true"]:hover,
      body.admin-readonly-mode [data-readonly-write-action="true"]:active,
      body.admin-readonly-mode .admin-readonly-action-locked:hover,
      body.admin-readonly-mode .admin-readonly-action-locked:active{
        transform:none!important;
      }

      body.admin-readonly-mode [data-readonly-write-action="true"] svg,
      body.admin-readonly-mode .admin-readonly-action-locked svg{
        opacity:.72;
      }
    `}</style>
  );
}

export function useReadOnlyAdminMode() {
  return useContext(ReadOnlyAdminContext);
}

export function textFromReactNode(node) {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromReactNode).join(" ");
  if (typeof node === "object" && "props" in node) return textFromReactNode(node.props?.children);
  return "";
}

function normalizeText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isReadOnlyWriteAction({ text = "", ariaLabel = "", title = "", icon = "", danger = false } = {}) {
  const descriptor = normalizeText([text, ariaLabel, title, icon].filter(Boolean).join(" "));
  if (!descriptor) return Boolean(danger);
  if (READ_ONLY_ALLOW_RE.test(descriptor)) return false;
  if (danger && !/\bcancel\b/i.test(descriptor)) return true;
  return READ_ONLY_WRITE_RE.test(descriptor);
}

export function getReadOnlyButtonState({ readOnly = false, disabled = false, loading = false, children, icon = "", danger = false, title = "" } = {}) {
  const locked =
    Boolean(readOnly) &&
    !disabled &&
    !loading &&
    isReadOnlyWriteAction({
      text: textFromReactNode(children),
      icon,
      danger,
      title,
    });

  return {
    locked,
    disabled: Boolean(disabled || loading || locked),
    title: locked ? READ_ONLY_ADMIN_LOCK_TITLE : title,
  };
}

function descriptorFromElement(element) {
  const text = element.textContent || element.value || "";
  const ariaLabel = element.getAttribute("aria-label") || "";
  const title = element.getAttribute("title") || "";
  const icon = element.getAttribute("data-icon") || "";
  const danger =
    element.classList.contains("danger") ||
    element.className?.toString().toLowerCase().includes("danger") ||
    element.getAttribute("data-danger") === "true";

  return { text, ariaLabel, title, icon, danger };
}

function shouldSkipElement(element) {
  if (!element) return true;
  if (element.closest("[data-readonly-admin-ignore='true']")) return true;
  if (element.getAttribute("data-readonly-admin-allow") === "true") return true;
  if (element.disabled) return true;
  return false;
}

function candidateControls(root) {
  const scope = root?.querySelectorAll ? root : document;
  return scope.querySelectorAll("button, input[type='button'], input[type='submit'], a[role='button'], a[href]");
}

export function annotateReadOnlyAdminActions(root = document) {
  if (typeof document === "undefined") return;

  candidateControls(root).forEach((element) => {
    if (shouldSkipElement(element)) {
      element.removeAttribute("data-readonly-write-action");
      return;
    }

    const explicitWrite = element.getAttribute("data-readonly-admin-write") === "true";
    const writeAction = explicitWrite || isReadOnlyWriteAction(descriptorFromElement(element));

    if (writeAction) {
      if (element.getAttribute("data-readonly-write-action") !== "true") {
        element.setAttribute("data-readonly-write-action", "true");
      }
      if (element.getAttribute("aria-disabled") !== "true") {
        element.setAttribute("aria-disabled", "true");
      }
      if (!element.getAttribute("title")) {
        element.setAttribute("title", READ_ONLY_ADMIN_LOCK_TITLE);
      }
    } else {
      element.removeAttribute("data-readonly-write-action");
      if (element.getAttribute("title") === READ_ONLY_ADMIN_LOCK_TITLE) {
        element.removeAttribute("title");
      }
    }
  });
}

export function installReadOnlyAdminDomGuard() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return () => {};
  }

  const scan = () => annotateReadOnlyAdminActions(document);
  const blockWriteAction = (event) => {
    const submitter = event.submitter || null;
    const element =
      submitter ||
      event.target?.closest?.(
        "[data-readonly-write-action='true'], button, input[type='button'], input[type='submit'], a[role='button'], a[href]",
      );
    if (!element || shouldSkipElement(element)) return;

    const writeAction =
      element.getAttribute("data-readonly-write-action") === "true" ||
      element.getAttribute("data-readonly-admin-write") === "true" ||
      isReadOnlyWriteAction(descriptorFromElement(element));

    if (!writeAction) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    element.blur?.();
  };

  scan();

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(scan);
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "aria-label", "title", "disabled"],
  });

  document.addEventListener("click", blockWriteAction, true);
  document.addEventListener("submit", blockWriteAction, true);

  return () => {
    observer.disconnect();
    document.removeEventListener("click", blockWriteAction, true);
    document.removeEventListener("submit", blockWriteAction, true);
    document.querySelectorAll("[data-readonly-write-action='true']").forEach((element) => {
      element.removeAttribute("data-readonly-write-action");
      element.removeAttribute("aria-disabled");
      if (element.getAttribute("title") === READ_ONLY_ADMIN_LOCK_TITLE) {
        element.removeAttribute("title");
      }
    });
  };
}
