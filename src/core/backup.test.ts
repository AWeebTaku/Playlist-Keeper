import { describe, expect, it } from 'vitest';
import { buildCsv, buildExport, exportFileName, FORMAT, parseExport, type ExportList } from './backup';

const L: ExportList[] = [
  {
    id: 'PL123',
    title: 'Road "trip" \u{1F698}',
    lastSync: 1_700_000_000,
    items: [
      { videoId: 'bbbbbbbbbbb', title: 'Second', artists: 'B', album: null, duration: 200, position: 1, status: 'unavailable', ytStatus: 'ok' },
      { videoId: 'aaaaaaaaaaa', title: 'First, with "quotes"', artists: 'A, C', album: 'Album', duration: 61, position: 0, status: 'ok', ytStatus: null },
    ],
  },
  { id: 'PL9', title: 'Empty', lastSync: null, items: [] },
];

describe('export file', () => {
  const text = buildExport(L, { app: 'Playlist Keeper 0.2.1', now: new Date('2026-11-07T10:00:00Z') });
  it('is valid JSON in a fixed, readable layout with one track per line', () => {
    expect(JSON.parse(text)).toMatchObject({ format: FORMAT, version: 1, exportedAt: '2026-11-07T10:00:00.000Z', app: 'Playlist Keeper 0.2.1' });
    expect(text).toMatchInlineSnapshot(`
      "{
        "format": "playlist-keeper/playlists",
        "version": 1,
        "exportedAt": "2026-11-07T10:00:00.000Z",
        "app": "Playlist Keeper 0.2.1",
        "playlists": [
          {
            "title": "Road \\"trip\\" 🚘",
            "id": "PL123",
            "url": "https://music.youtube.com/playlist?list=PL123",
            "lastSynced": "2023-11-14T22:13:20.000Z",
            "trackCount": 2,
            "tracks": [
              { "position": 1, "title": "First, with \\"quotes\\"", "artists": "A, C", "album": "Album", "durationSeconds": 61, "videoId": "aaaaaaaaaaa", "status": "ok", "youtube": null },
              { "position": 2, "title": "Second", "artists": "B", "album": null, "durationSeconds": 200, "videoId": "bbbbbbbbbbb", "status": "unavailable", "youtube": "ok" }
            ]
          },
          {
            "title": "Empty",
            "id": "PL9",
            "url": "https://music.youtube.com/playlist?list=PL9",
            "lastSynced": null,
            "trackCount": 0,
            "tracks": []
          }
        ]
      }
      "
    `);
  });
  it('reads back what it wrote, in saved order, with titles intact', () => {
    const back = parseExport(text);
    expect(back.map((s) => [s.id, s.title, s.items.length])).toEqual([['file:0', 'Road "trip" \u{1F698}', 2], ['file:1', 'Empty', 0]]);
    expect(back[0]!.items.map((i) => [i.videoId, i.title, i.status, i.ytStatus, i.duration])).toEqual([['aaaaaaaaaaa', 'First, with "quotes"', 'ok', null, 61], ['bbbbbbbbbbb', 'Second', 'unavailable', 'ok', 200]]);
  });
  it('names the file after a single playlist, safely', () => {
    expect(exportFileName([{ title: 'Road/trip: "mix"?' }], new Date('2026-11-07T10:00:00Z'))).toBe('Roadtrip mix 2026-11-07.json');
    expect(exportFileName(L, new Date('2026-11-07T10:00:00Z'))).toBe('Playlist Keeper playlists 2026-11-07.json');
  });
});

describe('import validation', () => {
  const ok = { format: FORMAT, version: 1, playlists: [{ title: 'X', tracks: [{ videoId: 'abcdefghijk', title: 'T', artists: 'A', durationSeconds: 10, status: 'ok' }] }] };
  it('rejects things that are not our export, with a message', () => {
    expect(() => parseExport('not json')).toThrow('not valid JSON');
    expect(() => parseExport('[]')).toThrow('not a Playlist Keeper export');
    expect(() => parseExport(JSON.stringify({ format: 'other', version: 1 }))).toThrow('not a Playlist Keeper export');
    expect(() => parseExport(JSON.stringify({ ...ok, version: 2 }))).toThrow('newer version');
    expect(() => parseExport(JSON.stringify({ ...ok, playlists: 'x' }))).toThrow('no playlists');
    expect(() => parseExport(JSON.stringify({ ...ok, playlists: [{ title: 'X' }] }))).toThrow('damaged');
  });
  it('drops rows without a usable video id and tolerates odd values', () => {
    const s = parseExport(JSON.stringify({ ...ok, playlists: [{ title: '  ', tracks: [{ videoId: 'abcdefghijk', status: 'weird', youtube: 'nope', durationSeconds: 'x' }, { videoId: '../../etc' }, { title: 'no id' }, 5] }] }));
    expect(s[0]!.title).toBe('Imported playlist 1');
    expect(s[0]!.items).toEqual([{ videoId: 'abcdefghijk', title: null, artists: '', duration: null, position: 0, status: 'ok', ytStatus: null }]);
  });
});

describe('csv export', () => {
  it('has a header, one row per track in playlist order, quoted cells, and no spreadsheet formulas', () => {
    const rows = buildCsv([...L, { id: 'X', title: '=HYPERLINK("evil")', lastSync: null, items: [{ ...L[0]!.items[0]!, title: '-1+1', position: 0 }] }]).split('\r\n');
    expect(rows[0]).toBe('playlist,position,title,artists,album,durationSeconds,videoId,status,youtube,url');
    expect(rows[1]).toBe('"Road ""trip"" \u{1F698}",1,"First, with ""quotes""","A, C",Album,61,aaaaaaaaaaa,ok,,https://music.youtube.com/watch?v=aaaaaaaaaaa');
    expect(rows[2]).toContain(',Second,B,,200,bbbbbbbbbbb,unavailable,ok,');
    expect(rows[3]).toBe(`"'=HYPERLINK(""evil"")",1,'-1+1,B,,200,bbbbbbbbbbb,unavailable,ok,https://music.youtube.com/watch?v=bbbbbbbbbbb`);
    expect(exportFileName(L, new Date('2026-11-07T10:00:00Z'), 'csv')).toBe('Playlist Keeper playlists 2026-11-07.csv');
  });
});
