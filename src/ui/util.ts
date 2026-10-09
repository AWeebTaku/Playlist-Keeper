import type { ItemRow } from '../services/db';

export const thumb = (videoId: string) => `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
export const mmss = (s: number | null) => (s == null ? '?' : s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
export const statusLabel = (s: ItemRow['status']) => (s === 'unavailable' ? 'Greyed out' : s === 'removed' ? 'Removed' : s === 'replaced' ? 'Replaced' : 'OK');
export const titleOf = (i: ItemRow) => i.cleanTitle || i.title || '(no saved title)';
export const artistOf = (i: ItemRow) => i.cleanArtist || i.artists || 'Unknown artist';
export const hideBroken = (e: Event) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden');
