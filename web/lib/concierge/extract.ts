import "server-only";
import { extractText as extractPdfText } from "unpdf";
import mammoth from "mammoth";
import { fail } from "@/lib/server/http";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_TEXT_CHARS = 500_000;

/** Upload types we can turn into text, by extension. The browser's MIME type is not trusted. */
const TYPES: Record<string, string> = {
  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export const TEXT_MIMES = new Set(["text/markdown", "text/plain", "text/csv", "application/json"]);
export const UPLOAD_ACCEPT = Object.keys(TYPES).map((e) => `.${e}`).join(",");

/** A safe, flat filename with a known extension. Knowledge files never contain a path. */
export function checkFilename(raw: string): { filename: string; mime: string } {
  const filename = raw.trim().replace(/\s+/g, "-");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(filename) || filename.includes(".."))
    fail(400, "Filenames use letters, numbers, dots, dashes and underscores (max 100)");
  const mime = TYPES[filename.split(".").pop()!.toLowerCase()];
  if (!mime) fail(400, `Supported files: ${UPLOAD_ACCEPT}`);
  return { filename, mime };
}

/** The readable text of an uploaded file. PDF pages are separated by blank lines so they chunk apart. */
export async function extractText(bytes: Uint8Array, mime: string): Promise<string> {
  let text: string;
  try {
    // pdf.js may detach the buffer it is given, so it gets a copy.
    if (mime === "application/pdf") text = (await extractPdfText(bytes.slice(), { mergePages: false })).text.join("\n\n");
    else if (mime === TYPES.docx) text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
    else text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(400, "Couldn't read any text from that file");
  }
  text = text.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").trim();
  if (!text) fail(400, "That file has no extractable text (scanned PDFs need OCR first)");
  if (text.length > MAX_TEXT_CHARS) fail(400, `That file has more than ${MAX_TEXT_CHARS.toLocaleString()} characters of text`);
  return text;
}
