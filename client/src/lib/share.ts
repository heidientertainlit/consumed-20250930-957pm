import { Capacitor } from '@capacitor/core';

const RAW_BASE = import.meta.env.VITE_APP_URL || 'https://app.consumedapp.com';
const BASE = RAW_BASE.startsWith('http') ? RAW_BASE : `https://${RAW_BASE}`;
const DEV_HTTP_BASE = import.meta.env.DEV
  && typeof window !== 'undefined'
  && /^https?:$/.test(window.location.protocol)
  ? window.location.origin
  : '';

// Always returns the real web URL — never capacitor://localhost or localhost.
// Use this everywhere you build a shareable link.
export const APP_BASE = DEV_HTTP_BASE || BASE;

export function appApiUrl(path: string) {
  return `${Capacitor.isNativePlatform() && !DEV_HTTP_BASE ? BASE : ''}${path}`;
}

async function copyShareText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Could not copy leaderboard link');
  }
}

export type ShareKind = 'list' | 'media' | 'prediction' | 'post' | 'edna' | 'profile' | 'leaderboard' | 'game';

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
  if (kind === 'list') return `${APP_BASE}${listPath(arg)}`;
  if (kind === 'edna') return `${APP_BASE}${ednaPath(arg)}`;
  if (kind === 'profile') {
    const id = typeof arg === 'string' ? arg : arg?.id;
    return `${APP_BASE}/u/${id}`;
  }
  if (kind === 'prediction' || kind === 'game') {
    const id = typeof arg === 'string' ? arg : arg?.id;
    return `${APP_BASE}/play?game=${id}`;
  }
  if (kind === 'leaderboard') {
    return `${APP_BASE}/leaderboard`;
  }
  if (kind === 'media') {
    // Media URLs need type/source/id structure: /media/movie/tmdb/951
    if (arg?.type && arg?.source && arg?.id) {
      return `${APP_BASE}/media/${arg.type}/${arg.source}/${arg.id}`;
    }
  }
  const id = typeof arg === 'string' ? arg : arg?.id;
  return `${APP_BASE}/${kind}/${id}`;
}

// Opens the native share sheet (iOS/Android — Messages, WhatsApp, etc.) when
// available; falls back to copying the link on desktop browsers.
// Returns 'shared' | 'copied' so callers can show the right feedback.
export async function shareLink(opts: { kind: ShareKind; id?: string; obj?: any; title?: string; text?: string }): Promise<'shared' | 'copied'> {
  const url = (opts.kind === 'list' || opts.kind === 'edna' || opts.kind === 'media')
    ? urlFor(opts.kind, opts.obj ?? { id: opts.id })
    : urlFor(opts.kind, opts.id!);

  if (navigator.share) {
    try {
      await navigator.share({ url, ...(opts.title ? { title: opts.title } : {}), ...(opts.text ? { text: opts.text } : {}) });
      return 'shared';
    } catch (err: any) {
      // User dismissed the sheet — do nothing further
      if (err?.name === 'AbortError') return 'shared';
      // Share failed for another reason — fall through to clipboard
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}

// Share a trivia question via the native share sheet (Messages/SMS, WhatsApp, etc.).
// Challenge links open the current Play screen and pin the exact question first.
// Falls back to copying the link on desktop. Returns 'shared' | 'copied'.
export async function shareTrivia(opts: { poolId: string; question?: string; fromUserId?: string; daily?: boolean; result?: 'right' | 'wrong' }): Promise<'shared' | 'copied'> {
  const search = new URLSearchParams();
  if (opts.fromUserId) search.set('from', opts.fromUserId);
  if (opts.daily) {
    search.set('open', 'todays-play');
    search.set('challenge', opts.poolId);
  }
  if (opts.result) search.set('result', opts.result);
  const query = search.toString();
  const url = opts.daily
    ? `${APP_BASE}/play${query ? `?${query}` : ''}`
    : `${APP_BASE}/play?mode=trivia&challenge=${encodeURIComponent(opts.poolId)}${opts.fromUserId ? `&from=${encodeURIComponent(opts.fromUserId)}` : ''}${opts.result ? `&result=${opts.result}` : ''}`;
  const resultText = opts.result === 'right'
    ? 'I got this one right.'
    : opts.result === 'wrong'
      ? 'I missed this one.'
      : 'I played this one.';
  const text = opts.question
    ? `${resultText} See how you score on "${opts.question}" — no spoilers. Play it on Consumed:`
    : `${resultText} See how you score — no spoilers. Play it on Consumed:`;

  if (navigator.share) {
    try {
      await navigator.share({ url, text, title: 'Consumed Trivia' });
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') return 'shared';
      // fall through to clipboard
    }
  }
  await navigator.clipboard.writeText(`${text} ${url}`);
  return 'copied';
}

export type PreparedLeaderboardRankShare = {
  url: string;
  text: string;
  title: string;
};

export async function prepareLeaderboardRankShare(opts: {
  accessToken: string;
  categoryId: string;
  period: 'weekly' | 'monthly' | 'all_time';
}): Promise<PreparedLeaderboardRankShare> {
  const response = await fetch(appApiUrl('/api/leaderboard-share'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      categoryId: opts.categoryId,
      period: opts.period,
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Could not create leaderboard share');
  }
  const { url, share } = await response.json();
  const periodLabel = share.period === 'weekly'
    ? 'this week'
    : share.period === 'monthly'
      ? 'this month'
      : 'all time';
  const text = share.rank === 1
    ? `I reached #1 in ${share.categoryLabel} ${periodLabel} on Consumed. Think you can catch me?`
    : `I reached #${share.rank} in ${share.categoryLabel} ${periodLabel} on Consumed. See where you rank:`;

  return {
    url,
    text,
    title: 'My Consumed leaderboard rank',
  };
}

export async function sharePreparedLeaderboardRank(
  prepared: PreparedLeaderboardRankShare
): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    try {
      await navigator.share(prepared);
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') return 'shared';
    }
  }

  await copyShareText(`${prepared.text} ${prepared.url}`);
  return 'copied';
}

export async function copyLink(opts: { kind: ShareKind; id?: string; obj?: any }) {
  const url = (opts.kind === 'list' || opts.kind === 'edna' || opts.kind === 'media')
    ? urlFor(opts.kind, opts.obj ?? { id: opts.id })
    : urlFor(opts.kind, opts.id!);

  await navigator.clipboard.writeText(url);
  return url;
}
