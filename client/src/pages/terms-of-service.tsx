import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { TermsContent } from "@/components/terms-content";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/" className="inline-flex items-center text-purple-600 hover:text-purple-700 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>

        <TermsContent />
      </div>
    </div>
  );
}
