CREATE TABLE IF NOT EXISTS playlists(id TEXT PRIMARY KEY, title TEXT, last_sync REAL, hidden INT DEFAULT 0);
CREATE TABLE IF NOT EXISTS items(
  playlist_id TEXT, video_id TEXT, title TEXT, artists TEXT, album TEXT, duration INT,
  set_video_id TEXT, position INT, first_seen REAL, last_seen REAL, status TEXT,
  clean_title TEXT, clean_artist TEXT, tags TEXT,
  PRIMARY KEY(playlist_id, video_id));
CREATE TABLE IF NOT EXISTS overrides(video_id TEXT PRIMARY KEY, title TEXT, artist TEXT);
CREATE INDEX IF NOT EXISTS items_by_video ON items(video_id);
