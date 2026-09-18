import { stat } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";
import GithubSlugger from "github-slugger";
import { readFiles, validateTranslations } from "./protocol.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const files = await readFiles(root), parser = new Marked(), failures = [], headings = new Map();
let documents = 0, links = 0, examples = 0, jsonFiles = 0;
function headingIds(text) {
  const slugger = new GithubSlugger(), ids = new Set();
  parser.walkTokens(parser.lexer(text), (token) => {
    if (token.type !== "heading") return;
    const plain = parser.parseInline(token.text).replace(/<[^>]+>/g, "").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#39;", "'");
    ids.add(slugger.slug(plain));
  });
  return ids;
}
for (const file of files.values()) {
  if (file.path.endsWith(".json")) { JSON.parse(file.content); jsonFiles++; continue; }
  documents++;
  const hrefs = [];
  parser.walkTokens(parser.lexer(file.content), (token) => {
    if (token.type === "link" || token.type === "image") hrefs.push(token.href);
    if (token.type === "code" && token.lang === "json") {
      try { JSON.parse(token.text); examples++; }
      catch (error) { failures.push(`${file.path}: invalid JSON example: ${error.message}`); }
    }
  });
  for (const href of hrefs) {
    if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(href)) continue;
    links++;
    const [pathname, fragment] = href.split("#", 2);
    const target = resolve(dirname(resolve(root, file.path)), decodeURIComponent(pathname));
    const name = relative(root, target).replaceAll("\\", "/");
    if (name === ".." || name.startsWith("../") || isAbsolute(name)) { failures.push(`${file.path}: link outside repository: ${href}`); continue; }
    try {
      const actual = pathname ? target : resolve(root, file.path);
      await stat(actual);
      const key = relative(root, actual).replaceAll("\\", "/");
      if (fragment && key.endsWith(".md")) {
        if (!headings.has(key)) headings.set(key, headingIds(files.get(key).content));
        if (!headings.get(key).has(decodeURIComponent(fragment))) failures.push(`${file.path}: missing heading: ${href}`);
      }
    } catch (error) { failures.push(`${file.path}: invalid local link: ${href} (${error.message})`); }
  }
}
if (failures.length) throw new Error(failures.join("\n"));
const protocolFiles = new Map([...files].filter(([path]) => path.startsWith("v1/")).map(([path, file]) => [path.slice(3), { ...file, path: path.slice(3) }]));
const result = validateTranslations(protocolFiles, { requireCurrent: process.argv.includes("--require-current") });
for (const warning of result.warnings) console.warn(warning);
console.log(`Verified ${links} local links in ${documents} Markdown files, ${examples} JSON examples, ${jsonFiles} JSON files, and ${result.pairs} current translation pairs.`);
