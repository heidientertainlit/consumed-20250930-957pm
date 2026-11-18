import { useEffect, useState } from "react";
import { Dna } from "lucide-react";

export function AccountLoadingScreen() {
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowLoader(true), 500);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-black via-slate-900 to-purple-900 px-6">
      {showLoader && <div role="status" aria-live="polite" className="text-center">
        <Dna
          aria-hidden="true"
          className="mx-auto h-7 w-7 animate-spin text-pink-400 motion-reduce:animate-none"
          strokeWidth={1.8}
        />
        <h1 className="mt-5 font-serif text-3xl leading-tight tracking-tight text-white">
          Okay, where were we?
        </h1>
        <p className="mt-2 text-sm text-purple-100/75">
          Let&apos;s see what everyone&apos;s into…
        </p>
      </div>}
    </div>
  );
}
