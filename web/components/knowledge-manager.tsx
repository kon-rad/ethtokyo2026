"use client";

import { useState, useEffect, useCallback } from "react";
import { KnowledgeEditor } from "./knowledge-editor";

type Props = {
  scope: "city" | "residency";
  slugOrAddress: string;
  sharedFiles?: { filename: string; label: string }[];
};

type FileInfo = { filename: string };

export function KnowledgeManager({ scope, slugOrAddress, sharedFiles }: Props) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [newFile, setNewFile] = useState(false);
  const [newFilename, setNewFilename] = useState("");

  const basePath =
    scope === "city"
      ? `/api/concierge/city/${slugOrAddress}/knowledge`
      : `/api/concierge/residency/${slugOrAddress}/knowledge`;

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(basePath);
      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      setError("Failed to load knowledge files");
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  async function handleEdit(filename: string) {
    setEditing(filename);
    setEditContent("");
    // Read the file content
    try {
      const res = await fetch(`${basePath}?file=${encodeURIComponent(filename)}`);
      const data = await res.json();
      setEditContent(data.content || "");
    } catch {
      setEditContent("# Error loading file\n\nCould not read this file.");
    }
  }

  async function handleSave(filename: string, content: string) {
    const res = await fetch(basePath, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, content }),
    });
    if (!res.ok) throw new Error("Save failed");
    setEditing(null);
    await loadFiles();
  }

  async function handleDelete(filename: string) {
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    const res = await fetch(basePath, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    });
    if (!res.ok) throw new Error("Delete failed");
    await loadFiles();
  }

  async function handleCreate() {
    if (!newFilename.trim() || !newFilename.endsWith(".md")) return;
    const content = `# ${newFilename.replace(/\.md$/, "").replace(/-/g, " ")}\n\nWrite your content here.\n`;
    const res = await fetch(basePath, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: newFilename, content }),
    });
    if (!res.ok) return;
    setNewFile(false);
    setNewFilename("");
    await loadFiles();
  }

  if (editing) {
    return (
      <KnowledgeEditor
        filename={editing}
        initialContent={editContent}
        onSave={async (content) => handleSave(editing, content)}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Knowledge Base</h2>
          <p className="text-sm text-muted">
            These files teach the concierge about this {scope}. Add, edit, or remove files below.
          </p>
        </div>
        <button
          onClick={() => setNewFile(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black"
        >
          + Add file
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {newFile && (
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
          <input
            value={newFilename}
            onChange={(e) => setNewFilename(e.target.value)}
            placeholder="filename.md"
            className="min-w-0 flex-1 rounded-xl border border-line bg-gray-50 px-3.5 py-2 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setNewFile(false);
                setNewFilename("");
              }
            }}
            autoFocus
          />
          <button
            onClick={handleCreate}
            disabled={!newFilename.trim() || !newFilename.endsWith(".md")}
            className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:bg-gray-300"
          >
            Create
          </button>
          <button
            onClick={() => {
              setNewFile(false);
              setNewFilename("");
            }}
            className="rounded-full border border-line px-4 py-2 text-sm font-medium text-muted transition hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-12 text-center">
          <p className="font-medium">No knowledge files yet.</p>
          <p className="mt-1 text-sm text-muted">
            Add files to teach the concierge about this {scope}.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {files.map((f) => (
            <div key={f.filename} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">📄</span>
                <span className="text-sm font-medium">{f.filename}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(f.filename)}
                  className="rounded-full border border-line px-3 py-1 text-xs font-medium transition hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(f.filename)}
                  className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-danger transition hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sharedFiles && sharedFiles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted">Shared knowledge (read-only)</h3>
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {sharedFiles.map((f) => (
              <div key={f.filename} className="flex items-center gap-3 px-4 py-3">
                <span className="text-lg">📄</span>
                <span className="text-sm font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}