"use client";

import { useState } from "react";

type Props = {
  filename: string;
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
};

export function KnowledgeEditor({ filename, initialContent, onSave, onCancel }: Props) {
  const [content, setContent] = useState(initialContent);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(content);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{filename}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setPreview(!preview)}
            className="rounded-full border border-line px-3 py-1 text-xs font-medium transition hover:bg-gray-50"
          >
            {preview ? "Edit" : "Preview"}
          </button>
          <button
            onClick={onCancel}
            className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted transition hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-gray-900 px-4 py-1 text-xs font-medium text-white transition hover:bg-black disabled:bg-gray-400"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {preview ? (
        <div className="prose prose-sm max-w-none rounded-xl border border-line bg-surface p-5">
          <MarkdownPreview content={content} />
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 font-mono text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
          rows={20}
        />
      )}
    </div>
  );
}

/** Simple markdown renderer that handles headings, bold, italic, lists, links, code. */
function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: string[] = [];

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc space-y-1 pl-5">
          {listItems.map((item, i) => (
            <li key={i}>{renderInline(item.replace(/^[-*]\s+/, ""))}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  }

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Blank line — flush list
    if (trimmed === "") {
      flushList();
      elements.push(<br key={`br-${idx}`} />);
      return;
    }

    // List item
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      inList = true;
      listItems.push(trimmed);
      return;
    }

    flushList();

    // Heading
    if (trimmed.startsWith("### ")) {
      elements.push(<h3 key={idx} className="mt-4 text-base font-semibold">{renderInline(trimmed.slice(4))}</h3>);
    } else if (trimmed.startsWith("## ")) {
      elements.push(<h2 key={idx} className="mt-5 text-lg font-semibold">{renderInline(trimmed.slice(3))}</h2>);
    } else if (trimmed.startsWith("# ")) {
      elements.push(<h1 key={idx} className="mt-5 text-xl font-bold">{renderInline(trimmed.slice(2))}</h1>);
    } else {
      elements.push(<p key={idx} className="leading-relaxed">{renderInline(trimmed)}</p>);
    }
  });

  flushList();
  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    // Italic: *text*
    const italicParts = part.split(/(\*[^*]+\*)/g);
    return italicParts.map((p, j) => {
      if (p.startsWith("*") && p.endsWith("*") && p.length > 2) {
        return <em key={`${i}-${j}`}>{p.slice(1, -1)}</em>;
      }
      // Inline code: `text`
      const codeParts = p.split(/(`[^`]+`)/g);
      return codeParts.map((c, k) => {
        if (c.startsWith("`") && c.endsWith("`")) {
          return <code key={`${i}-${j}-${k}`} className="rounded bg-gray-100 px-1 font-mono text-xs">{c.slice(1, -1)}</code>;
        }
        return c;
      });
    });
  });
}