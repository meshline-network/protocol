# Maintaining the bilingual specification

Simplified Chinese (`zh-Hans`) is the authoritative specification. Each English document (`en`) has a corresponding Chinese document with the same filename, heading hierarchy, table field order, and code-block order. Translation must preserve requirements, prohibitions, recommendations, and optional behavior.

## Language and translation rules

- Use MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY according to the meaning of the corresponding Chinese requirement. See the [bilingual glossary](glossary.md) for the terminology mapping; do not mechanically replace ordinary descriptive wording with normative keywords.
- Compare fields, methods, error codes, identifiers, numeric ranges, units, algorithms, byte order, and cryptographic inputs individually.
- Keep non-Mermaid code blocks identical between language versions. Use English identifiers and illustrative labels in shared examples. Do not translate or reformat shared JSON test vectors or create separate language-specific copies. Their Unicode strings can be test inputs, signed content, or expected results; changing them can change byte lengths, hashes, and signatures.
- Mermaid node labels and message descriptions may be translated. Preserve node IDs, edges, direction, ordering, conditions, and protocol method names.
- Use relative Markdown links within the same language. Link JSON files to the shared test-vector directory. Generate heading anchors from the current language's headings. Language switching opens the corresponding document at its top.
- Update the corresponding translation structure when adding or removing sections. The first bilingual release requires every document to be present and reviewed. Routine publication may include existing translations explicitly marked as stale.

## Review records

`translations.json` records the SHA-256 hashes of the Chinese and English document bytes at the time of review, the review date, and a SHA-256 fingerprint of the shared JSON collection. These records establish a comparison baseline.

After comparing a document's meaning with its source, run `npm run review -- <relative-document-path>` from the repository root to record the review. After checking the applicability of shared JSON data, run `npm run review -- --vectors`. The review command checks structural and code-block consistency, but not links; it does not replace semantic review. Ordinary synchronization and build commands do not update review records.

For example, after completing the corresponding reviews:

```sh
npm run review -- registry/README.md
npm run review -- --vectors
```

## Validation

`npm test` checks local Markdown links and heading anchors, JSON files and examples, translation records, and the structural consistency of current translations. It reports stale translations explicitly. `npm run check:current` also requires all translations and shared test-vector review records to be current. Validation does not update review records.

If either a Chinese document or its translation changes, the English page displays a pending-update notice and the last review date. Changes to shared JSON mark the English pages with a test-data update notice. Missing translations produce an English explanation and a link to the Chinese source. Corrupted snapshots, broken links, orphaned translations, and incomplete review records are structural errors.

## Downstream synchronization

The website stores a content snapshot that it can build independently. After changing the specification, run the following commands in the website repository, using the same protocol source directory for both synchronization and comparison:

```sh
npm run sync:protocol -- --source <path-to-protocol-v1>
npm run check:protocol -- --source <path-to-protocol-v1>
npm run build:protocol
npm test
```

SDKs and other implementations may store a snapshot of test vectors from a specific version, recording its source and file hashes. Once protocol releases are published, downstream consumers should pin a specific tag or commit.
