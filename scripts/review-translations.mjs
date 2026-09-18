import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readFiles, validatePair, vectorsHash } from "./protocol.mjs";

const root = fileURLToPath(new URL("../v1/", import.meta.url));
const files = await readFiles(root);
const path = join(root, "maintenance/translations.json");
const records = JSON.parse(await readFile(path, "utf8"));
const names = process.argv.slice(2);
if (!names.length) throw new Error("After reviewing the translation, pass its relative Markdown path, or --vectors after reviewing shared data applicability.");
for (const name of names) {
  if (name === "--vectors") { records.vectorsSha256 = vectorsHash(files); continue; }
  const source = files.get(`zh-Hans/${name}`), target = files.get(`en/${name}`);
  if (!source || !target) throw new Error(`Missing translation pair: ${name}`);
  validatePair(source.content, target.content, name);
  records.documents[name] = { sourceSha256: source.sha256, translationSha256: target.sha256, reviewedAt: new Date().toISOString().slice(0, 10) };
}
records.documents = Object.fromEntries(Object.entries(records.documents).sort(([a], [b]) => a.localeCompare(b, "en")));
await writeFile(path, JSON.stringify(records, null, 2) + "\n");
console.log(`Recorded explicit review for: ${names.join(", ")}. Update the website snapshot after validation.`);
