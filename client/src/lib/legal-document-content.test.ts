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

function readUploadedSource(fileName: string) {
  return readFileSync(join(repositoryRoot, "attached_assets", fileName), "utf8");
}

test("rendered Terms blocks preserve every supplied visible source line", () => {
  const source = readUploadedSource(
    "Pasted-Terms-of-Service-Entertainlit-Inc-dba-Consumed-Effectiv_1789505348262.txt",
  );
  const document = parseLegalDocument(source, "terms");

  assert.equal(flattenLegalDocumentText(document), sourceVisibleText(source));
  assert.match(flattenLegalDocumentText(document), /at least 16 years old/);
  assert.match(flattenLegalDocumentText(document), /September 15, 2026/);
});

test("rendered Privacy Policy blocks preserve every supplied visible source line", () => {
  const source = readUploadedSource(
    "Pasted--Privacy-Policy-EntertainLit-Inc-dba-Consumed-Effective_1789505592802.txt",
  );
  const document = parseLegalDocument(source, "privacy");

  assert.equal(flattenLegalDocumentText(document), sourceVisibleText(source));
  assert.match(flattenLegalDocumentText(document), /at least 16 years old/);
  assert.match(flattenLegalDocumentText(document), /September 15, 2026/);
});