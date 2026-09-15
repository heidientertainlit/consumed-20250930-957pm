import { TermsDocument } from "@/components/legal-document";

interface TermsContentProps {
  className?: string;
}

/**
 * The same supplied Terms document is used by the public route and the
 * pre-auth/login dialog.
 */
export function TermsContent({ className }: TermsContentProps) {
  return <TermsDocument className={className} />;
}