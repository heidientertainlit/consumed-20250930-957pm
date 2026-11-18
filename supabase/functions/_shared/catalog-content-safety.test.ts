import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedCatalogVideo } from "./catalog-content-safety";

test("explicit labels are rejected even with false or missing provider flags", () => {
  for (const title of [
    "The Office: A XXX Parody Collection",
    "The Office: A ＸＸＸ Parody Collection",
    "The Office: A X\u200bXX Parody Collection",
    "Office — An X-Rated Parody",
    "Office Pornographic Parody Collection",
    "Office Parody XXX",
    "Office Hardcore Porn Collection",
    "Office Softcore Pornographic Collection",
  ]) {
    assert.equal(isAllowedCatalogVideo({ title, adult: false }), false, title);
    assert.equal(isAllowedCatalogVideo({ name: title }), false, title);
    assert.equal(isAllowedCatalogVideo({ original_title: title }), false, title);
    assert.equal(isAllowedCatalogVideo({ original_name: title }), false, title);
  }
  assert.equal(isAllowedCatalogVideo({ title: "An ordinary title", adult: true }), false);
  assert.equal(isAllowedCatalogVideo({ title: "An ordinary title", softcore: true }), false);
  assert.equal(isAllowedCatalogVideo({ title: "An ordinary title", keywords: { keywords: [{ name: "softcore" }] } }), false);
});

test("self-described pornographic metadata is blocked without censoring general subject matter", () => {
  for (const overview of [
    "A pornographic parody of a workplace sitcom.",
    "An explicit pornographic film.",
    "This is a hardcore porn film.",
    "A XXX parody of a popular movie.",
  ]) {
    assert.equal(isAllowedCatalogVideo({ title: "Office", overview }), false, overview);
    assert.equal(isAllowedCatalogVideo({ title: "Office", description: overview }), false, overview);
  }
});

test("mainstream franchises, mature drama, and industry documentaries remain available", () => {
  for (const item of [
    { title: "The Office", overview: "A workplace comedy series." },
    { title: "Harry Potter Collection" },
    { title: "xXx", overview: "An extreme sports athlete becomes a secret agent.", adult: false },
    { title: "xXx: State of the Union", overview: "An action spy thriller." },
    { title: "xXx Collection", overview: "An action franchise." },
    { title: "Sex Education", overview: "A coming-of-age comedy." },
    { title: "Romance", overview: "A mature drama about an adult relationship with sexual themes." },
    { title: "Young Adult", overview: "A dark comedy." },
    { title: "Documentary", overview: "A documentary about pornographic films and their history." },
    { title: "Drama", overview: "An actor leaves pornographic films to build a new life." },
    { title: "Scary Movie", overview: "A parody of horror films." },
  ]) assert.equal(isAllowedCatalogVideo(item), true, item.title);
});
