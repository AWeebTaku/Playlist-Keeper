import { describe, expect, it } from 'vitest';
import { clean, shortQueryVariants, songKey } from './sanitize';

describe('clean', () => {
  it('keeps unknown brackets as variant tags', () => {
    const c = clean('【MV】Creepy Nuts - 堕天(DATEN)', 'Creepy Nuts');
    expect(c.title).toBe('堕天 (DATEN)');
    expect(c.key).toBe('堕天 daten');
    expect(c.tags).toEqual(['daten']);
  });
  it('drops noise and uploader prefixes', () => {
    expect(clean('NewDad - Waves (Official Audio)', 'NewDad').title).toBe('Waves');
    expect(clean('Dandelions (Audio)', 'Ruth B.').tags).toEqual([]);
    expect(clean('Song (Album Version)', 'A').tags).toEqual([]);
    expect(clean('Song (Remastered 2011)', 'A').tags).toEqual([]);
  });
  it('moves featuring credits out of the key', () => {
    const c = clean('Choosy ft. Jeremih, Davido (Official Video)', 'Fabolous');
    expect(c.title).toBe('Choosy (ft. Jeremih, Davido)');
    expect(c.key).toBe('choosy');
  });
  it('strips Topic from artists and symbols from titles', () => {
    expect(clean('Song - Topic ♪', 'X - Topic').artist).toBe('X');
  });
  it('treats remix, cover, sped up and unknown parentheticals as variants', () => {
    expect(clean('Song (Stellular Remix)', 'A').tags).toEqual(['stellular remix']);
    expect(clean('Song [sped up + pitched] [nightcore]', 'A').tags).toEqual(['nightcore', 'sped up pitched']);
    expect(clean('Song Cover', 'A').tags).toEqual(['cover']);
    expect(clean('Song (Epic Version)', 'A').tags).toEqual(['epic version']);
  });
});

describe('songKey', () => {
  it('official video equals lyric video, remix differs', () => {
    const k = (t: string) => songKey(t, 'A');
    expect(k('Song (Official Video)').key).toBe(k('Song [Lyrics]').key);
    expect(k('Song (Official Video)').tags).toEqual(k('Song [Lyrics]').tags);
    expect(k('Song').tags).not.toEqual(k('Song (Remix)').tags);
  });
});

describe('shortQueryVariants', () => {
  it('puts the quoted song name first, show title last', () => {
    const q = shortQueryVariants('『チェンソーマン』ノンクレジットオープニング / CHAINSAW MAN  Opening│米津玄師 「KICK BACK」', 'MAPPA CHANNEL');
    expect(q[0]).toMatch(/^KICK BACK/);
    expect(q).toContain('KICK BACK');
  });
  it('uses the text after a bar plus the show name', () => {
    expect(shortQueryVariants('GANGSTA. - Opening | Renegade', 'Crunchyroll').slice(0, 2)).toEqual(['Renegade GANGSTA.', 'Renegade']);
    expect(shortQueryVariants('Mushoku Tensei: Jobless Reincarnation Season 2 Part 2 Opening | On the Frontline', 'Crunchyroll')[0]).toBe(
      'On the Frontline Mushoku Tensei: Jobless Reincarnation',
    );
  });
  it('strips OP/ED words from plain titles and handles empty input', () => {
    expect(shortQueryVariants('Naruto Opening 3 (TV Size)', 'X')[0]).toBe('Naruto');
    expect(shortQueryVariants('', '')).toEqual([]);
  });
});
