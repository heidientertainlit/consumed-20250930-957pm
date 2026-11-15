export function useToast() { return { toast: (detail: unknown) => window.dispatchEvent(new CustomEvent("dna-fixture-toast", { detail })) }; }
