import type { ItemRow, PlaylistRow } from '../services/db';

export const thumb = (videoId: string) => `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
export const mmss = (s: number | null) => (s == null ? '?' : s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
export const statusLabel = (s: ItemRow['status']) => (s === 'unavailable' ? 'Greyed out' : s === 'removed' ? 'Removed' : s === 'replaced' ? 'Replaced' : 'OK');
export const titleOf = (i: ItemRow) => i.cleanTitle || i.title || '(no saved title)';
export const artistOf = (i: ItemRow) => i.cleanArtist || i.artists || 'Unknown artist';
export const hideBroken = (e: Event) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden');

/** Cover art of a playlist: YouTube's tile if known, else the thumbnail of its first playable track. */
export const coverUrl = (p: Pick<PlaylistRow, 'thumb' | 'coverVideo'>): string | null => p.thumb ?? (p.coverVideo ? thumb(p.coverVideo) : null);

/** "just now", "5 min ago", "3 h ago", "2 days ago", or "never". */
export function ago(seconds: number | null, now = Date.now() / 1000): string {
  if (!seconds) return 'never synced';
  const d = Math.max(0, now - seconds);
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
  return `${Math.floor(d / 86400)} day${d >= 172800 ? 's' : ''} ago`;
}
