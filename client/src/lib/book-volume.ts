export function getBookVolumeLabel(media: {
  type?: string;
  volume_number?: number | null;
}): string | null {
  if (media.type !== "book" || typeof media.volume_number !== "number") {
    return null;
  }

  return `Volume ${media.volume_number}`;
}