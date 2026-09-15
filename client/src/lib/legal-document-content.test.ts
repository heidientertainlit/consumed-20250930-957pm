import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  flattenLegalDocumentText,
  parseLegalDocument,
  sourceVisibleText,
} from "./legal-document-model";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readLegalSource(fileName: string) {
  return readFileSync(join(repositoryRoot, "client/src/content/legal", fileName), "utf8");
}

test("rendered Terms blocks preserve every supplied visible source line", () => {
  const source = readLegalSource("terms.txt");
  const document = parseLegalDocument(source, "terms");

  assert.equal(flattenLegalDocumentText(document), sourceVisibleText(source));
  assert.match(flattenLegalDocumentText(document), /at least 16 years old/);
  assert.match(flattenLegalDocumentText(document), /September 15, 2026/);
});

test("rendered Privacy Policy blocks preserve every supplied visible source line", () => {
  const source = readLegalSource("privacy.txt");
  const document = parseLegalDocument(source, "privacy");

  assert.equal(flattenLegalDocumentText(document), sourceVisibleText(source));
  assert.match(flattenLegalDocumentText(document), /at least 16 years old/);
  assert.match(flattenLegalDocumentText(document), /September 15, 2026/);
});