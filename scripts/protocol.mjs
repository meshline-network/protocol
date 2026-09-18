import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { Marked } from "marked";

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const vectorsHash = (files) => sha256([...files.values()].filter((f) => /^test-vectors\/[^/]+\.json$/.test(f.path)).sort((a, b) => a.path.localeCompare(b.path, "en")).map((f) => `${f.path}:${f.sha256}\n`).join(""));

export async function readFiles(root) {
  const files = new Map();
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if ([".git", "node_modules", "coverage"].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(md|json)$/.test(entry.name)) {
        const name = relative(root, path).replaceAll("\\", "/");
        const bytes = await readFile(path);
        files.set(name, { path: name, content: bytes.toString("utf8"), sha256: sha256(bytes) });
      }
    }
  }
  await walk(root);
  return files;
}

export function structure(content) {
  const tokens = new Marked().lexer(content);
  const headings = [], code = [], tables = [], diagrams = [];
  const visit = (items) => {
    for (const token of items) {
      if (token.type === "heading") headings.push(token.depth);
      if (token.type === "code") {
        if (token.lang === "mermaid") diagrams.push(token.text);
        else code.push({ language: token.lang ?? "", text: token.text });
      }
      if (token.type === "table") tables.push({ columns: token.header.length, rows: token.rows.map((row) => ({ columns: row.length, fields: row[0].text.match(/`[^`]+`/g) ?? [] })) });
      if (token.type === "blockquote") visit(token.tokens);
      if (token.type === "list") token.items.forEach((item) => visit(item.tokens));
    }
  };
  visit(tokens);
  return { headings, code, tables, diagramCount: diagrams.length };
}

export function validatePair(source, translation, name) {
  const a = structure(source), b = structure(translation);
  for (const key of ["headings", "code", "tables", "diagramCount"]) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) throw new Error(`Translation ${key} mismatch: ${name}`);
  }
}

export function validateTranslations(files, { requireCurrent = false } = {}) {
  for (const path of ["zh-Hans/README.md", "maintenance/translations.json"]) {
    if (!files.has(path)) throw new Error(`Missing required source: ${path}`);
  }
  const records = JSON.parse(files.get("maintenance/translations.json").content);
  if (records.schemaVersion !== 1 || records.sourceLanguage !== "zh-Hans" || records.targetLanguage !== "en" || !records.documents || typeof records.documents !== "object" || Array.isArray(records.documents)) throw new Error("Invalid translation records");
  if (records.vectorsSha256 !== null && !/^[a-f0-9]{64}$/.test(records.vectorsSha256)) throw new Error("Invalid vector review fingerprint");
  const warnings = [];
  if (records.vectorsSha256 !== vectorsHash(files)) warnings.push("Shared test vectors need translation applicability review.");
  for (const [name, record] of Object.entries(records.documents)) {
    if (!files.has(`zh-Hans/${name}`) || !files.has(`en/${name}`)) throw new Error(`Orphan translation record: ${name}`);
    if (!/^[a-f0-9]{64}$/.test(record.sourceSha256) || !/^[a-f0-9]{64}$/.test(record.translationSha256) || !/^\d{4}-\d{2}-\d{2}$/.test(record.reviewedAt) || Number.isNaN(Date.parse(record.reviewedAt))) throw new Error(`Invalid translation record: ${name}`);
  }
  let pairs = 0;
  for (const file of files.values()) {
    if (file.path.startsWith("en/") && !files.has(`zh-Hans/${file.path.slice(3)}`)) throw new Error(`Orphan English document: ${file.path}`);
    if (!file.path.startsWith("zh-Hans/")) continue;
    const name = file.path.slice(8), translated = files.get(`en/${name}`), record = records.documents[name];
    if (translated && !record) throw new Error(`Missing translation record: ${name}`);
    const state = !translated ? "missing" : record.sourceSha256 !== file.sha256 || record.translationSha256 !== translated.sha256 ? "stale" : "current";
    if (state !== "current") warnings.push(`${state}: en/${name}`);
    else { validatePair(file.content, translated.content, name); pairs++; }
  }
  if (requireCurrent && warnings.length) throw new Error(`Translations are not current:\n${warnings.join("\n")}`);
  return { warnings, pairs };
}
