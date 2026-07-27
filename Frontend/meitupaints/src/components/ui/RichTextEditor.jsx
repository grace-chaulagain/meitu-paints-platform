import { useEffect, useMemo } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extensions";
import DOMPurify from "dompurify";

// Deliberately narrow: only the marks/nodes the composer's toolbar exposes
// (bold, italic, bullet/ordered list, link, paragraph) are registered -
// blockquote/code/heading/etc. from StarterKit are disabled so the editor
// can never produce HTML the shared email shell (Server/src/utils/email.js)
// doesn't already render safely.
const BASE_EXTENSIONS = [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    link: false,
  }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    protocols: ["http", "https", "mailto"],
    HTMLAttributes: { rel: "noopener noreferrer" },
  }),
];

function ToolbarIcon({ children }) {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const ICONS = {
  bold: <ToolbarIcon><path d="M6 4h7a3.5 3.5 0 0 1 0 7H6z" /><path d="M6 11h8a3.5 3.5 0 0 1 0 7H6z" /></ToolbarIcon>,
  italic: <ToolbarIcon><path d="M11 4h6" /><path d="M7 20h6" /><path d="M14 4 10 20" /></ToolbarIcon>,
  bulletList: <ToolbarIcon><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" /><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /></ToolbarIcon>,
  orderedList: <ToolbarIcon><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="M4 6h1v3" /><path d="M4 14h2l-2 2h2" /></ToolbarIcon>,
  link: <ToolbarIcon><path d="M9.5 14.5 14.5 9.5" /><path d="M12 6.5 13.6 4.9a3 3 0 1 1 4.5 4l-1.6 1.6" /><path d="M12 17.5 10.4 19.1a3 3 0 1 1-4.5-4l1.6-1.6" /></ToolbarIcon>,
};

function ToolbarButton({ active, onClick, disabled, title, icon }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      style={{
        display: "grid",
        placeItems: "center",
        width: 30,
        height: 30,
        borderRadius: 8,
        border: "none",
        background: active ? "rgba(0,113,227,.12)" : "transparent",
        color: active ? "#0071e3" : "#474747",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "background 120ms ease-out, color 120ms ease-out",
      }}
    >
      {ICONS[icon]}
    </button>
  );
}

// Thin Tiptap wrapper: `value` seeds the editor's initial content only
// (Tiptap doesn't support live-syncing external content changes without
// risking clobbering in-progress typing), `onChange(html)` fires sanitized
// HTML out on every edit (dompurify client-side, matching the same
// allowlist the backend's sanitize-html re-applies before persisting/
// sending - defense in depth, not a substitute for the server-side pass).
// To reset/clear the editor from outside (e.g. after a successful send),
// remount it with a changed `key` prop rather than changing `value`.
export default function RichTextEditor({ value = "", onChange, placeholder = "Write your announcement..." }) {
  const extensions = useMemo(
    () => [...BASE_EXTENSIONS, Placeholder.configure({ placeholder })],
    [placeholder],
  );

  const editor = useEditor({
    extensions,
    content: value || "",
    onUpdate: ({ editor: editorInstance }) => {
      const html = DOMPurify.sanitize(editorInstance.getHTML(), {
        ALLOWED_TAGS: ["p", "br", "strong", "em", "ul", "ol", "li", "a"],
        ALLOWED_ATTR: ["href", "rel", "target"],
      });
      onChange?.(html);
    },
    editorProps: {
      attributes: {
        style: "min-height:160px;outline:none;font-size:14.5px;line-height:1.65;color:#1d1d1f;",
      },
    },
  });

  useEffect(() => {
    return () => editor?.destroy();
  }, [editor]);

  // Tiptap v3's useEditor no longer re-renders on every transaction by
  // default (shouldRerenderOnTransaction defaults to false) - toggling a
  // mark on a collapsed cursor only sets a "stored mark" (no document
  // change, so onUpdate never fires), so without this the toolbar button
  // would stay unhighlighted until the next keystroke actually changed the
  // doc. useEditorState subscribes to every transaction internally and only
  // re-renders this component when the selected snapshot actually changes.
  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      isBold: instance?.isActive("bold") ?? false,
      isItalic: instance?.isActive("italic") ?? false,
      isBulletList: instance?.isActive("bulletList") ?? false,
      isOrderedList: instance?.isActive("orderedList") ?? false,
      isLink: instance?.isActive("link") ?? false,
    }),
  });

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href || "";
    const url = window.prompt("Link URL", previousUrl);
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  return (
    <div style={{ border: "1px solid rgba(232,232,237,.9)", borderRadius: 16, overflow: "hidden", background: "#ffffff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "6px 8px", borderBottom: "1px solid rgba(232,232,237,.9)", background: "#f5f5f7" }}>
        <ToolbarButton title="Bold" icon="bold" active={toolbarState.isBold} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarButton title="Italic" icon="italic" active={toolbarState.isItalic} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <div style={{ width: 1, height: 18, background: "rgba(232,232,237,.9)", margin: "0 4px" }} />
        <ToolbarButton title="Bullet list" icon="bulletList" active={toolbarState.isBulletList} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolbarButton title="Numbered list" icon="orderedList" active={toolbarState.isOrderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <div style={{ width: 1, height: 18, background: "rgba(232,232,237,.9)", margin: "0 4px" }} />
        <ToolbarButton title="Link" icon="link" active={toolbarState.isLink} onClick={setLink} />
      </div>
      <div style={{ padding: "14px 16px" }}>
        <EditorContent editor={editor} />
      </div>
      <style>{`
        .tiptap p { margin: 0 0 10px; }
        .tiptap p:last-child { margin-bottom: 0; }
        .tiptap ul, .tiptap ol { margin: 0 0 10px; padding-left: 20px; }
        .tiptap a { color: #0071e3; text-decoration: none; }
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #a1a1aa;
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
