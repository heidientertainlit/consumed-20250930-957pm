export type LegalDocumentKind = "terms" | "privacy";

export type LegalDocumentBlock =
  | {
      kind: "paragraph";
      text: string;
    }
  | {
      kind: "list";
      items: string[];
    }
  | {
      kind: "subheading";
      text: string;
    };

export interface LegalDocumentSection {
  heading: string;
  blocks: LegalDocumentBlock[];
}

export interface ParsedLegalDocument {
  title: string;
  metadata: string;
  introduction: LegalDocumentBlock[];
  sections: LegalDocumentSection[];
}

function linesFromSource(source: string) {
  return source.replace(/\r\n?/g, "\n").split("\n");
}

function removeTrailingBlankLines(lines: string[]) {
  while (lines.at(-1)?.trim() === "") lines.pop();
  return lines;
}

/**
 * Converts the small amount of Markdown used in the supplied policy into
 * visible text. This is also used by the source-fidelity test so that links
 * and emphasis can be rendered without changing their visible wording.
 */
export function visibleLegalText(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/^#{1,3}\s+/, "")
    .replace(/^\*\s+/, "");
}

function parseTermsDocument(source: string): ParsedLegalDocument {
  const lines = removeTrailingBlankLines(linesFromSource(source));
  const title = lines.shift()?.trim() ?? "";
  const metadata = lines.shift()?.trim() ?? "";
  const introduction: LegalDocumentBlock[] = [];
  const firstParagraph = lines.shift()?.trim();
  if (firstParagraph) introduction.push({ kind: "paragraph", text: firstParagraph });

  const sections: LegalDocumentSection[] = [];
  let section: LegalDocumentSection | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^\d+\.\s/.test(line)) {
      section = { heading: line, blocks: [] };
      sections.push(section);
      continue;
    }

    if (!section) {
      introduction.push({ kind: "paragraph", text: line });
      continue;
    }

    section.blocks.push({ kind: "paragraph", text: line });
  }

  // Section 5 is the one supplied section whose trailing paragraphs are
  // explicitly an acceptable-use list. Keeping the introductory sentence as
  // a paragraph preserves both the supplied wording and its list formatting.
  const acceptableUse = sections.find((item) => item.heading.startsWith("5. "));
  if (acceptableUse && acceptableUse.blocks.length > 1) {
    const [intro, ...items] = acceptableUse.blocks;
    acceptableUse.blocks = [
      intro,
      {
        kind: "list",
        items: items.map((item) =>
          item.kind === "paragraph" ? item.text : "",
        ),
      },
    ];
  }

  return { title, metadata, introduction, sections };
}

function flushParagraph(
  blocks: LegalDocumentBlock[],
  paragraphLines: string[],
) {
  if (paragraphLines.length) {
    blocks.push({ kind: "paragraph", text: paragraphLines.join("\n") });
    paragraphLines.length = 0;
  }
}

function parsePrivacyDocument(source: string): ParsedLegalDocument {
  const lines = removeTrailingBlankLines(linesFromSource(source));
  const title = visibleLegalText(lines.shift()?.trim() ?? "");
  while (lines[0]?.trim() === "") lines.shift();
  const metadata = visibleLegalText(lines.shift()?.trim() ?? "");
  const introduction: LegalDocumentBlock[] = [];
  const sections: LegalDocumentSection[] = [];
  let section: LegalDocumentSection | null = null;
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushPending = () => {
    flushParagraph(section ? section.blocks : introduction, paragraphLines);
    if (listItems.length) {
      (section ? section.blocks : introduction).push({
        kind: "list",
        items: [...listItems],
      });
      listItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushPending();
      continue;
    }

    const sectionHeading = line.match(/^##\s+(.+)$/);
    if (sectionHeading) {
      flushPending();
      section = { heading: visibleLegalText(sectionHeading[1]), blocks: [] };
      sections.push(section);
      continue;
    }

    const subheading = line.match(/^###\s+(.+)$/);
    if (subheading) {
      flushPending();
      (section ? section.blocks : introduction).push({
        kind: "subheading",
        text: visibleLegalText(subheading[1]),
      });
      continue;
    }

    if (line.startsWith("* ")) {
      flushParagraph(section ? section.blocks : introduction, paragraphLines);
      // Keep inline Markdown in each item so links and emphasis remain
      // interactive in the renderer. The list marker itself is structural.
      listItems.push(line.slice(2));
      continue;
    }

    if (listItems.length) {
      flushPending();
    }
    // Keep inline Markdown until renderInline can turn supplied links into
    // anchors. Source-fidelity flattening removes it separately.
    paragraphLines.push(line);
  }
  flushPending();

  return { title, metadata, introduction, sections };
}

export function parseLegalDocument(
  source: string,
  kind: LegalDocumentKind,
): ParsedLegalDocument {
  return kind === "terms"
    ? parseTermsDocument(source)
    : parsePrivacyDocument(source);
}

/**
 * Returns one visible-text line for every source line represented by the
 * parsed document. Markdown links and emphasis are intentionally removed so
 * this can be compared directly with the uploaded source files.
 */
export function flattenLegalDocumentText(document: ParsedLegalDocument) {
  const lines: string[] = [document.title, document.metadata];

  const appendBlock = (block: LegalDocumentBlock) => {
    if (block.kind === "list") {
      lines.push(...block.items.map(visibleLegalText));
      return;
    }
    lines.push(...block.text.split("\n").map(visibleLegalText));
  };

  document.introduction.forEach(appendBlock);
  document.sections.forEach((section) => {
    lines.push(section.heading);
    section.blocks.forEach(appendBlock);
  });

  return lines.join("\n");
}

export function sourceVisibleText(source: string) {
  return removeTrailingBlankLines(linesFromSource(source))
    .filter((line) => line.trim() !== "")
    .map((line) => visibleLegalText(line.trim()))
    .join("\n");
}