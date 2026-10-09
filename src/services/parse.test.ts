import { describe, expect, it } from 'vitest';
import { continuationToken, isSignedOut, parseDuration, parseLibraryPlaylists, parseTracks } from './parse';

const run = (text: string, navigationEndpoint?: object) => ({ text, ...(navigationEndpoint ? { navigationEndpoint } : {}) });
const page = (pageType: string) => ({ browseEndpoint: { browseEndpointContextSupportedConfigs: { browseEndpointContextMusicConfig: { pageType } } } });
const item = (o: { id?: string; set?: string; title?: string; artists?: string[]; album?: string; dur?: string; grey?: boolean }) => ({
  musicResponsiveListItemRenderer: {
    playlistItemData: o.id ? { videoId: o.id, playlistSetVideoId: o.set } : undefined,
    flexColumns: [
      { musicResponsiveListItemFlexColumnRenderer: { text: { runs: [run(o.title ?? 'T', o.grey ? undefined : { watchEndpoint: {} })] } } },
      { musicResponsiveListItemFlexColumnRenderer: { text: { runs: (o.artists ?? ['A']).flatMap((a, i) => { const r = run(a, o.grey ? undefined : page('MUSIC_PAGE_TYPE_ARTIST')); return i ? [run(' & '), r] : [r]; }) } } },
      { musicResponsiveListItemFlexColumnRenderer: { text: { runs: o.album ? [run(o.album, o.grey ? undefined : page('MUSIC_PAGE_TYPE_ALBUM'))] : [] } } },
    ],
    fixedColumns: [{ musicResponsiveListItemFixedColumnRenderer: { text: { runs: [run(o.dur ?? '3:45')] } } }],
    ...(o.grey ? { musicItemRendererDisplayPolicy: 'MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT' } : {}),
  },
});

describe('parseTracks', () => {
  const page = { contents: { musicPlaylistShelfRenderer: { contents: [item({ id: 'v1', set: 's1', title: 'One', artists: ['X', 'Y'], album: 'Alb' }), item({ id: 'v2', title: 'Two', grey: true, dur: '1:02:03', album: 'Greyed album' }), item({ title: 'no id' })] } } };
  it('reads id, setVideoId, title, joined artists, album, duration and the grey-out flag', () => {
    const t = parseTracks(page);
    expect(t).toHaveLength(2); // the entry without a videoId is skipped
    expect(t[0]).toEqual({ videoId: 'v1', setVideoId: 's1', title: 'One', artists: 'X, Y', album: 'Alb', duration: 225, available: true });
    expect(t[1]).toMatchObject({ videoId: 'v2', available: false, duration: 3723, album: 'Greyed album', title: 'Two' }); // greyed entries have no links, preset columns apply
  });
  it('parses durations', () => {
    expect(parseDuration('3:45')).toBe(225);
    expect(parseDuration('1:02:03')).toBe(3723);
    expect(parseDuration('LIVE')).toBeNull();
    expect(parseDuration(undefined)).toBeNull();
  });
});

describe('parseTracks scope', () => {
  const rows = (...ids: string[]) => ids.map((id) => item({ id }));
  it('ignores the suggestions shelf of an editable playlist', () => {
    const page = { contents: { shelf: { musicPlaylistShelfRenderer: { contents: rows('mine1', 'mine2') } }, suggestions: { musicShelfRenderer: { contents: rows('sug1', 'sug2', 'sug3') } } } };
    expect(parseTracks(page).map((t) => t.videoId)).toEqual(['mine1', 'mine2']);
  });
  it('reads both continuation page styles', () => {
    expect(parseTracks({ continuationContents: { musicPlaylistShelfContinuation: { contents: rows('a') } } }).map((t) => t.videoId)).toEqual(['a']);
    expect(parseTracks({ onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: rows('b', 'c') } }] }).map((t) => t.videoId)).toEqual(['b', 'c']);
  });
  it('returns nothing for an unknown structure instead of guessing', () => {
    expect(parseTracks({ contents: { other: rows('x') } })).toEqual([]);
  });
});

describe('continuationToken', () => {
  it('finds the next-page token in both response styles', () => {
    expect(continuationToken({ x: [{ continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'T1' } } } }] })).toBe('T1');
    expect(continuationToken({ continuations: [{ nextContinuationData: { continuation: 'T2' } }] })).toBe('T2');
    expect(continuationToken({ contents: [] })).toBeNull();
  });
});

describe('parseLibraryPlaylists', () => {
  it('skips the New playlist tile and strips the VL prefix', () => {
    const page = { items: [
      { musicTwoRowItemRenderer: { title: { runs: [run('New playlist')] } } },
      { musicTwoRowItemRenderer: { title: { runs: [run('!Music1')] }, subtitle: { runs: [run('Me'), run(' • '), run('4,998 tracks')] }, navigationEndpoint: { browseEndpoint: { browseId: 'VLPLabc' } } } },
      { musicTwoRowItemRenderer: { title: { runs: [run('Episodes for later')] }, navigationEndpoint: { browseEndpoint: { browseId: 'VLSE' } } } },
    ] };
    expect(parseLibraryPlaylists(page)).toEqual([{ id: 'PLabc', title: '!Music1', count: 4998 }, { id: 'SE', title: 'Episodes for later', count: null }]);
  });
});

describe('isSignedOut', () => {
  const page = (v: string) => ({ responseContext: { serviceTrackingParams: [{ service: 'GFEEDBACK', params: [{ key: 'browse_id', value: 'x' }, { key: 'logged_in', value: v }] }] } });
  it('reads the logged_in flag of the response', () => {
    expect(isSignedOut(page('0'))).toBe(true);
    expect(isSignedOut(page('1'))).toBe(false);
    expect(isSignedOut({})).toBe(false); // continuation pages carry no flag
  });
});
