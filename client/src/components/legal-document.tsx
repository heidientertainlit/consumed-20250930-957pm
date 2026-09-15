import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  parseLegalDocument,
  type LegalDocumentBlock,
  type LegalDocumentKind,
} from "@/lib/legal-document-model";
import { privacySource, termsSource } from "@/lib/legal-document-source";
import {
  APPLE_STANDARD_EULA_URL,
  PRIVACY_POLICY_PATH,
  SUPPORT_EMAIL,
} from "@/lib/legal-terms";

interface LegalDocumentProps {
  kind: LegalDocumentKind;
  className?: string;
}

function linkClassName() {
  return "text-purple-700 underline underline-offset-2 hover:text-purple-900";
}

function renderPlainInline(text: string): ReactNode {
  const patterns = [
    {
      text: "Apple’s Standard Licensed Application End User License Agreement",
      render: (value: string) => (
        <a
          href={APPLE_STANDARD_EULA_URL}
          target="_blank"
          rel="noreferrer"
          className={linkClassName()}
        >
          {value}
        </a>
      ),
    },
    {
      text: SUPPORT_EMAIL,
      render: (value: string) => (
        <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClassName()}>
          {value}
        </a>
      ),
    },
    {
      text: "Privacy Policy",
      render: (value: string) => (
        <a href={PRIVACY_POLICY_PATH} className={linkClassName()}>
          {value}
        </a>
      ),
    },
  ];

  let remaining = text;
  const nodes: ReactNode[] = [];
  let key = 0;
  while (remaining) {
    let nextPattern = patterns
      .map((pattern) => ({
        pattern,
        index: remaining.indexOf(pattern.text),
      }))
      .filter(({ index }) => index >= 0)
      .sort((a, b) => a.index - b.index)[0];

    if (!nextPattern) {
      nodes.push(remaining);
      break;
    }

    if (nextPattern.index > 0) {
      nodes.push(remaining.slice(0, nextPattern.index));
    }
    nodes.push(
      <span key={`legal-inline-${key++}`}>
        {nextPattern.pattern.render(nextPattern.pattern.text)}
      </span>,
    );
    remaining = remaining.slice(
      nextPattern.index + nextPattern.pattern.text.length,
    );
  }
  return nodes;
}

function renderInline(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining) {
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      nodes.push(
        <a
          key={`legal-markdown-link-${key++}`}
          href={href}
          className={linkClassName()}
        >
          {label}
        </a>,
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      nodes.push(
        <strong key={`legal-bold-${key++}`}>
          {renderInline(boldMatch[1])}
        </strong>,
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    const nextMarker = remaining.search(/\*\*|\[/);
    if (nextMarker < 0) {
      nodes.push(renderPlainInline(remaining));
      break;
    }
    if (nextMarker > 0) {
      nodes.push(renderPlainInline(remaining.slice(0, nextMarker)));
      remaining = remaining.slice(nextMarker);
      continue;
    }

    // An unmatched marker is still source text and must remain visible.
    nodes.push(remaining[0]);
    remaining = remaining.slice(1);
  }

  return nodes;
}

function renderBlock(block: LegalDocumentBlock, index: number): ReactNode {
  if (block.kind === "subheading") {
    return (
      <h3
        key={`legal-subheading-${index}`}
        className="text-base font-medium text-gray-800"
      >
        {renderInline(block.text)}
      </h3>
    );
  }

  if (block.kind === "list") {
    return (
      <ul
        key={`legal-list-${index}`}
        className="list-disc space-y-2 pl-5"
      >
        {block.items.map((item, itemIndex) => (
          <li key={`legal-list-item-${index}-${itemIndex}`}>
            {renderInline(item)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <p key={`legal-paragraph-${index}`} className="leading-relaxed">
      {renderInline(block.text)}
    </p>
  );
}

export function LegalDocument({ kind, className }: LegalDocumentProps) {
  const source = kind === "terms" ? termsSource : privacySource;
  const document = parseLegalDocument(source, kind);

  return (
    <article className={cn("text-sm leading-relaxed text-gray-700", className)}>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {document.title}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {renderInline(document.metadata)}
        </p>
      </header>

      {document.introduction.length > 0 && (
        <div className="mb-6 space-y-3">
          {document.introduction.map(renderBlock)}
        </div>
      )}

      <div className="space-y-8">
        {document.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              {renderInline(section.heading)}
            </h2>
            <div className="space-y-3">
              {section.blocks.map(renderBlock)}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

export function TermsDocument({ className }: { className?: string }) {
  return <LegalDocument kind="terms" className={className} />;
}

export function PrivacyDocument({ className }: { className?: string }) {
  return <LegalDocument kind="privacy" className={className} />;
}