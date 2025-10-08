const RAW_BASE = import.meta.env.VITE_APP_URL || 'https://app.consumedapp.com';
const BASE = RAW_BASE.startsWith('http') ? RAW_BASE : `https://${RAW_BASE}`;

export type ShareKind = 'list' | 'media' | 'prediction' | 'post' | 'edna' | 'profile' | 'leaderboard';

function listPath(input: { id?: string; user_id?: string; isCurrently?: boolean }) {
  if (input?.isCurrently && input?.user_id) return `/list/currently?user=${input.user_id}`;
  if (input?.id && input?.user_id) return `/list/${input.id}?user=${input.user_id}`;
  if (input?.id) return `/list/${input.id}`;
  return '/list';
}

function ednaPath(input: { id?: string; user_id?: string }) {
  if (input?.id && input?.user_id) return `/edna/${input.id}?user=${input.user_id}`;
  if (input?.id) return `/edna/${input.id}`;
  return '/edna';
}

export function urlFor(kind: ShareKind, arg: any) {
  if (kind === 'list') return `${BASE}${listPath(arg)}`;
  if (kind === 'edna') return `${BASE}${ednaPath(arg)}`;
  if (kind === 'profile') {
    const id = typeof arg === 'string' ? arg : arg?.id;
    return `${BASE}/user/${id}`;
  }
  if (kind === 'prediction') {
    const id = typeof arg === 'string' ? arg : arg?.id;
    return `${BASE}/play#${id}`;
  }
  if (kind === 'leaderboard') {
    return `${BASE}/leaderboard`;
  }
  const id = typeof arg === 'string' ? arg : arg?.id;
  return `${BASE}/${kind}/${id}`;
}

export async function copyLink(opts: { kind: ShareKind; id?: string; obj?: any }) {
  console.log('=== copyLink called ===');
  console.log('kind:', opts.kind);
  console.log('id:', opts.id);
  console.log('obj:', opts.obj);
  
  const url = (opts.kind === 'list' || opts.kind === 'edna')
    ? urlFor(opts.kind, opts.obj ?? { id: opts.id })
    : urlFor(opts.kind, opts.id!);

  console.log('Generated URL:', url);
  
  await navigator.clipboard.writeText(url);
  return url;
}
