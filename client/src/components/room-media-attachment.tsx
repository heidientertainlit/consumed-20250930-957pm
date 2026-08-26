import { Film, Link2, Mic2, Music2, Tv, BookOpen, Gamepad2, X, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

export type RoomMediaAttachment = {
  title: string;
  type?: string | null;
  mediaType?: string | null;
  creator?: string | null;
  author?: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
  poster_url?: string | null;
  thumbnail?: string | null;
  externalId?: string | null;
  external_id?: string | null;
  externalSource?: string | null;
  external_source?: string | null;
  seasonNumber?: number | null;
  season_number?: number | null;
  episodeNumber?: number | null;
  episode_number?: number | null;
  episodeTitle?: string | null;
  episode_title?: string | null;
  mediaSubtype?: string | null;
  media_subtype?: string | null;
  mediaUrl?: string | null;
  media_url?: string | null;
  youtubeVideoId?: string | null;
  youtubeChannelId?: string | null;
  youtubeChannelName?: string | null;
};

export function roomMediaAttachmentToDatabaseFields(media: RoomMediaAttachment | null | undefined) {
  if (!media) {
    return {
      media_title: null, media_type: null, media_creator: null, media_image_url: null,
      media_external_id: null, media_external_source: null, media_season_number: null,
      media_episode_number: null, media_episode_title: null, media_subtype: null, media_url: null,
    };
  }
  const type = media.type || media.mediaType || null;
  return {
    media_title: media.title || null,
    media_type: type === "book_series" ? "book" : type,
    media_creator: media.creator || media.author || null,
    media_image_url: media.imageUrl || media.image_url || media.poster_url || media.thumbnail || null,
    media_external_id: media.externalId || media.external_id || null,
    media_external_source: media.externalSource || media.external_source || (media.youtubeVideoId ? "youtube" : null),
    media_season_number: media.seasonNumber ?? media.season_number ?? null,
    media_episode_number: media.episodeNumber ?? media.episode_number ?? null,
    media_episode_title: media.episodeTitle || media.episode_title || null,
    media_subtype: media.mediaSubtype || media.media_subtype || null,
    media_url: safeExternalUrl(media.mediaUrl || media.media_url),
  };
}
export const toRoomMediaDatabaseFields = roomMediaAttachmentToDatabaseFields;

export function roomMediaAttachmentFromRecord(record: any): RoomMediaAttachment | null {
  if (!record?.media_title) return null;
  return {
    title: record.media_title,
    type: record.media_type,
    creator: record.media_creator,
    imageUrl: record.media_image_url,
    externalId: record.media_external_id,
    externalSource: record.media_external_source,
    seasonNumber: record.media_season_number,
    episodeNumber: record.media_episode_number,
    episodeTitle: record.media_episode_title,
    mediaSubtype: record.media_subtype,
    mediaUrl: record.media_url,
    youtubeVideoId: record.media_external_source === "youtube" && record.media_subtype !== "channel"
      ? record.media_external_id
      : null,
    youtubeChannelId: record.media_external_source === "youtube" && record.media_subtype === "channel"
      ? record.media_external_id
      : null,
  };
}

export function roomMediaHref(media: RoomMediaAttachment): string | undefined {
  const source = media.externalSource || media.external_source;
  const externalId = media.externalId || media.external_id;
  const type = media.type || media.mediaType;
  if (!source || !externalId) return undefined;
  if (source === "youtube") {
    if (!/^[A-Za-z0-9_-]{6,}$/.test(externalId)) return undefined;
    return (media.mediaSubtype || media.media_subtype) === "channel"
      ? `https://www.youtube.com/channel/${encodeURIComponent(externalId)}`
      : `https://www.youtube.com/watch?v=${encodeURIComponent(externalId)}`;
  }
  const storedUrl = safeExternalUrl(media.mediaUrl || media.media_url);
  if (storedUrl) return storedUrl;
  return `/media/${encodeURIComponent(type === "book_series" ? "book" : type || "movie")}/${encodeURIComponent(source)}/${encodeURIComponent(externalId)}`;
}

function safeExternalUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const icons: Record<string, typeof Film> = { movie: Film, tv: Tv, book: BookOpen, podcast: Mic2, music: Music2, game: Gamepad2, youtube: Link2 };
const label = (type: string) => type === "tv" ? "TV" : type === "youtube" ? "YouTube" : type ? type.charAt(0).toUpperCase() + type.slice(1) : "Media";

type Props = {
  media: RoomMediaAttachment;
  editable?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  href?: string;
  compact?: boolean;
  className?: string;
  trailing?: ReactNode;
};

export function RoomMediaAttachment({ media, editable = false, onRemove, onClick, href, compact = false, className = "", trailing }: Props) {
  const type = (media.type || media.mediaType || "").toLowerCase();
  const Icon = icons[type] || Film;
  const image = media.imageUrl || media.image_url || media.poster_url || media.thumbnail;
  const season = media.seasonNumber ?? media.season_number;
  const episode = media.episodeNumber ?? media.episode_number;
  const source = (media.externalSource || media.external_source || (media.youtubeVideoId ? "youtube" : type)).toLowerCase();
  const subtype = media.mediaSubtype || media.media_subtype;
  const isYoutube = source === "youtube" || type === "youtube" || subtype === "video" || subtype === "channel";
  const content = (
    <>
      <div className={`relative shrink-0 overflow-hidden bg-[#eee9e4] ${compact ? "h-14 w-11 rounded-md" : "h-[76px] w-[58px] rounded-lg"}`}>
        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[#988f88]"><Icon size={compact ? 17 : 22} /></div>}
      </div>
      <div className="min-w-0 flex-1 self-center">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.11em] text-[#91877e]">
          <Icon size={12} aria-hidden="true" /><span>{isYoutube ? "YouTube" : label(type)}</span>
          {source && !isYoutube && <><span className="opacity-40">·</span><span>{source}</span></>}
        </div>
        <p className={`${compact ? "text-[13px]" : "text-[14px]"} truncate font-semibold text-[#2f2926]`}>{media.title}</p>
        {(media.creator || media.author || media.youtubeChannelName) && <p className="mt-0.5 truncate text-xs text-[#837a73]">{isYoutube && media.youtubeChannelName ? media.youtubeChannelName : media.creator || media.author}</p>}
        {type === "tv" && (season != null || episode != null) && <p className="mt-1 text-xs font-medium text-[#756a62]">Season {season ?? "—"}{episode != null ? ` · Episode ${episode}` : ""}{media.episodeTitle ? ` — ${media.episodeTitle}` : media.episode_title ? ` — ${media.episode_title}` : ""}</p>}
        {isYoutube && subtype === "channel" && <p className="mt-1 text-xs text-[#756a62]">Channel</p>}
      </div>
      {trailing}
      {editable && onRemove && <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }} aria-label={`Remove ${media.title}`} className="ml-1 rounded-full p-1.5 text-[#8c8179] transition-colors hover:bg-[#eee9e4] hover:text-[#3b332f]"><X size={16} /></button>}
    </>
  );
  const classes = `flex items-center gap-3 border border-[#e6dfd9] bg-[#fbfaf8] p-2.5 text-left transition-colors ${onClick || href ? "cursor-pointer hover:border-[#cfc2b7] hover:bg-[#f8f4f0]" : ""} ${compact ? "rounded-xl" : "rounded-2xl"} ${className}`;
  if (href) {
    const external = /^https?:\/\//i.test(href);
    return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} onClick={(event) => event.stopPropagation()} className={classes} aria-label={`Open ${media.title}`}>{content}<ExternalLink className="shrink-0 text-[#978b82]" size={14} /></a>;
  }
  if (onClick) return <button type="button" onClick={onClick} className={`w-full ${classes}`}>{content}</button>;
  return <div className={classes}>{content}</div>;
}

export default RoomMediaAttachment;