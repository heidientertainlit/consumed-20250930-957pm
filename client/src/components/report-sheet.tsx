import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Flag, Ban, ChevronRight, AlertCircle, MessageSquareWarning, ShieldAlert, ThumbsDown, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

const REPORT_REASONS = [
  { id: "spam", label: "Spam", description: "Repetitive or unwanted content", icon: MessageSquareWarning },
  { id: "harassment", label: "Harassment", description: "Bullying or targeted abuse", icon: ShieldAlert },
  { id: "hate_speech", label: "Hate speech", description: "Content that attacks people", icon: AlertCircle },
  { id: "misinformation", label: "Misinformation", description: "False or misleading information", icon: AlertCircle },
  { id: "inappropriate", label: "Inappropriate", description: "Content not suitable for this platform", icon: ThumbsDown },
  { id: "spoiler", label: "Spoiler", description: "Reveals plot details without warning", icon: AlertCircle },
  { id: "other", label: "Other", description: "Something else is wrong", icon: Flag },
];

interface ReportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: "post" | "comment" | "user";
  contentId: string;
  reportedUserId?: string;
  reportedUserName?: string;
}

export function ReportSheet({
  isOpen,
  onClose,
  contentType,
  contentId,
  reportedUserId,
  reportedUserName,
}: ReportSheetProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"reason" | "confirm" | "done">("reason");
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setStep("reason");
    setSelectedReason(null);
    setAlsoBlock(false);
    onClose();
  };

  const handleSelectReason = (reasonId: string) => {
    setSelectedReason(reasonId);
    setStep("confirm");
  };

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Sign in required", description: "You need to be signed in to report content." });
        handleClose();
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-content`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            content_type: contentType,
            content_id: contentId,
            reason: selectedReason,
            reported_user_id: reportedUserId || null,
          }),
        }
      );

      const result = await res.json();

      if (!res.ok && result.error !== "You have already reported this content") {
        throw new Error(result.error || "Failed to submit report");
      }

      if (alsoBlock && reportedUserId) {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/block-user`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ blocked_user_id: reportedUserId }),
          }
        );
      }

      setStep("done");
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto pb-safe bg-white text-gray-900">
        {step === "reason" && (
          <>
            <SheetHeader className="pb-2">
              <SheetTitle className="text-base font-semibold text-gray-900 text-left">
                {contentType === "user" ? `Report ${reportedUserName ? `@${reportedUserName}` : "user"}` : `Report ${contentType === "post" ? "post" : contentType === "comment" ? "comment" : "hot take"}`}
              </SheetTitle>
              <p className="text-sm text-gray-500 text-left">Why are you reporting this?</p>
            </SheetHeader>
            <div className="mt-3 divide-y divide-gray-100">
              {REPORT_REASONS.map((r) => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.id}
                    onClick={() => handleSelectReason(r.id)}
                    className="w-full flex items-center justify-between py-3.5 px-1 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} className="text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{r.label}</p>
                        <p className="text-xs text-gray-400">{r.description}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300" />
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <SheetHeader className="pb-4">
              <SheetTitle className="text-base font-semibold text-gray-900 text-left">Confirm report</SheetTitle>
            </SheetHeader>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-gray-500 mb-1">Reason</p>
              <p className="text-sm font-medium text-gray-900 capitalize">
                {REPORT_REASONS.find((r) => r.id === selectedReason)?.label}
              </p>
            </div>

            {reportedUserId && (
              <button
                onClick={() => setAlsoBlock(!alsoBlock)}
                className="w-full flex items-center gap-3 p-4 mb-4 rounded-xl border border-gray-200 text-left"
              >
                <Ban size={18} className={alsoBlock ? "text-red-500" : "text-gray-400"} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Also block {reportedUserName ? `@${reportedUserName}` : "this user"}
                  </p>
                  <p className="text-xs text-gray-400">Their posts won't appear in your feed</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${alsoBlock ? "border-red-500 bg-red-500" : "border-gray-300"}`}>
                  {alsoBlock && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
            )}

            <p className="text-xs text-gray-400 mb-5">
              Reports are anonymous. Our team reviews all reports and takes action when content violates community guidelines.
            </p>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep("reason")} disabled={isSubmitting}>
                Back
              </Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600 text-white border-0"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Submit report"}
              </Button>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="py-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
              <Flag size={24} className="text-green-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900 mb-1">Report submitted</p>
              <p className="text-sm text-gray-500">
                Thanks for helping keep Consumed safe. We'll review this shortly.
              </p>
            </div>
            <Button className="mt-2 bg-purple-600 hover:bg-purple-700 text-white" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
