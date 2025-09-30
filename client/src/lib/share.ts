const BASE = import.meta.env.VITE_APP_URL!;
const FEATURE_SHARES = import.meta.env.VITE_FEATURE_SHARES === 'true';

export type ShareKind = 'list' | 'media' | 'prediction' | 'post' | 'edna';

export function urlFor(kind: ShareKind, id: string) {
  return `${BASE}/${kind}/${id}`;
}

export async function shareThing(opts: { kind: ShareKind; id: string; title: string; }) {
  const url = urlFor(opts.kind, opts.id);
  const text = `I'm on Consumed — ${opts.title}. Join me: ${url}`;

  // When FEATURE_SHARES is ON (post-Vercel), try native share with a URL
  if (FEATURE_SHARES && navigator.share) {
    try { 
      await navigator.share({ title: opts.title, url }); 
      return 'shared';
    } catch {
      // User cancelled or share failed
    }
  }

  // Replit-safe fallbacks: mobile share sheet (text) → clipboard
  if (navigator.share) { 
    try { 
      await navigator.share({ text }); 
      return 'shared';
    } catch {
      // Fall through to clipboard
    }
  }
  
  await navigator.clipboard.writeText(text);
  return 'copied';
}
