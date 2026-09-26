"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { KnowledgeEditor } from "./knowledge-editor";

type Props = {
  scope: "city" | "residency";
  slugOrAddress: string;
  sharedFiles?: { filename: string; label: string }[];
};

type FileInfo = { filename: string; mime: string; chars: number; hasOriginal: boolean };

const TEXT_MIMES = new Set(["text/markdown", "text/plain", "text/csv", "application/json"]);
const UPLOAD_ACCEPT = ".md,.markdown,.txt,.csv,.json,.pdf,.docx";

async function errorOf(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return (data as { error?: string }).error ?? fallback;
}

export function KnowledgeManager({ scope, slugOrAddress, sharedFiles }: Props) {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState<FileInfo | null>(null);
  const [editContent, setEditContent] = useState("");
  const [newFile, setNewFile] = useState(false);
  const [newFilename, setNewFilename] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const basePath =
    scope === "city"
      ? `/api/concierge/city/${slugOrAddress}/knowledge`
      : `/api/concierge/residency/${slugOrAddress}/knowledge`;

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(basePath);
      if (!res.ok) throw new Error(await errorOf(res, "Failed to load knowledge files"));
      const data = await res.json();
      setFiles(data.files || []);
      setCanEdit(!!data.canEdit);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load knowledge files");
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Load before opening: the editor reads its initial content once, on mount.
  async function handleEdit(file: FileInfo) {
    setError(null);
    try {
      const res = await fetch(`${basePath}?file=${encodeURIComponent(file.filename)}`);
      if (!res.ok) throw new Error(await errorOf(res, "Could not read this file"));
      const data = await res.json();
      setEditContent(data.file?.content ?? "");
      setEditing(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this file");
    }
  }

  async function handleSave(filename: string, content: string) {
    setError(null);
    const res = await fetch(basePath, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, content }),
    });
    if (!res.ok) {
      setError(await errorOf(res, "Save failed"));
      return;
    }
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
    if (!res.ok) {
      setError(await errorOf(res, "Delete failed"));
      return;
    }
    await loadFiles();
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(basePath, { method: "POST", body: form });
      if (!res.ok) throw new Error(await errorOf(res, "Upload failed"));
      await loadFiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  async function handleCreate() {
    if (!newFilename.trim() || !newFilename.endsWith(".md")) return;
    const content = `# ${newFilename.replace(/\.md$/, "").replace(/-/g, " ")}\n\nWrite your content here.\n`;
    const res = await fetch(basePath, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: newFilename, content }),
    });
    if (!res.ok) {
      setError(await errorOf(res, "Couldn't create the file"));
      return;
    }
    setNewFile(false);
    setNewFilename("");
    await loadFiles();
  }

  if (editing) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}
        <KnowledgeEditor
        filename={editing.filename}
        initialContent={editContent}
        readOnly={!canEdit || !TEXT_MIMES.has(editing.mime)}
        originalUrl={editing.hasOriginal ? `${basePath}?file=${encodeURIComponent(editing.filename)}&original=1` : null}
        onSave={async (content) => handleSave(editing.filename, content)}
        onCancel={() => {
          setEditing(null);
          setError(null);
        }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Knowledge Base</h2>
          <p className="text-sm text-muted">
            These files teach the concierge about this {scope}.{" "}
            {canEdit
              ? "Write markdown, or upload PDF, Word, text or CSV files: their text is extracted and made searchable."
              : `Only the ${scope === "city" ? "city's founder" : "host"} can change them.`}
          </p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 gap-2">
            <input
              ref={uploadRef}
              type="file"
              accept={UPLOAD_ACCEPT}
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
            <button
              onClick={() => uploadRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-medium transition hover:bg-gray-50 disabled:text-muted"
            >
              {uploading ? "Extracting…" : "Upload file"}
            </button>
            <button
              onClick={() => setNewFile(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black"
            >
              + Add file
            </button>
          </div>
        )}
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
            {canEdit ? `Add files to teach the concierge about this ${scope}.` : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {files.map((f) => (
            <div key={f.filename} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-lg">📄</span>
                <span className="text-sm font-medium">{f.filename}</span>
                <span className="text-xs text-muted">{f.chars.toLocaleString()} chars</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(f)}
                  className="rounded-full border border-line px-3 py-1 text-xs font-medium transition hover:bg-gray-50"
                >
                  {canEdit && TEXT_MIMES.has(f.mime) ? "Edit" : "View"}
                </button>
                {canEdit && (
                  <button
                    onClick={() => handleDelete(f.filename)}
                    className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-danger transition hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
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