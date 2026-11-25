import { describe, expect, it } from 'vitest';
import { countRows, sanitize } from '../scripts/make-fixture.mjs';
import { parseTracks } from '../src/services/parse';

const row = (id: string, grey = false) => ({ musicResponsiveListItemRenderer: { playlistItemData: { videoId: id, playlistSetVideoId: 's' + id }, ...(grey ? { musicItemRendererDisplayPolicy: 'MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT' } : {}), flexColumns: [], trackingParams: 'x' } });

describe('make-fixture sanitize', () => {
  const page = { responseContext: { visitorData: 'secret' }, trackingParams: 't', header: { activeAccountHeaderRenderer: { accountName: 'Me' } }, contents: { musicPlaylistShelfRenderer: { contents: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((i) => row(i)).concat([row('grey', true)]) } } };
  it('drops tracking and account data at any depth', () => {
    const out = JSON.stringify(sanitize(page));
    for (const bad of ['responseContext', 'visitorData', 'trackingParams', 'activeAccountHeaderRenderer', 'secret']) expect(out).not.toContain(bad);
  });
  it('keeps at most N rows but never loses the greyed-out one', () => {
    const out = sanitize(page, 4);
    expect(countRows(out)).toBe(4);
    expect(parseTracks(out).map((t) => t.videoId)).toContain('grey');
  });
  it('does not change its input', () => {
    sanitize(page, 2);
    expect(page.contents.musicPlaylistShelfRenderer.contents).toHaveLength(9);
  });
});
