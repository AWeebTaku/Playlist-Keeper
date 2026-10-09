/** A playlist entry as the rest of the app sees it (already flattened from YouTube's response). */
export interface Track {
  videoId: string;
  setVideoId?: string | null;
  title: string | null;
  /** Artist names joined with ", ". */
  artists: string;
  album?: string | null;
  duration: number | null; // seconds
  /** False when YouTube Music greys the entry out (cannot be played). */
  available: boolean;
}

export type Status = 'ok' | 'unavailable' | 'removed' | 'replaced';
