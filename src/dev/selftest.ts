/**
 * Dev-only end-to-end check inside the real Tauri webview (VITE_SELFTEST=1 npm run tauri dev).
 * Logs counts and booleans only, never cookies or tokens. Compiled out of release builds.
 */
import { info } from '@tauri-apps/plugin-log';
import { cleanedFields } from '../services/db';
import { openRepo } from '../services/app';
import { signInWithBrowserCookies, browserChoices, profilesOf } from '../services/auth';
import * as actions from '../services/actions';
import { syncAll, syncPlaylist } from '../services/sync';
import { rankFull } from '../core/full';
import { shortQueryVariants } from '../core/sanitize';

const log = (m: string) => info(`[selftest] ${m}`);

/** Read-only runs of the screens' logic on real data. */
async function actionChecks(repo: import('../services/db').Repo, yt: import('../services/yt').Yt): Promise<void> {
  const lists = await repo.playlists();
  const queue = lists.find((p) => p.title === '!Queue');
  if (!queue) return;
  const items = await repo.items(queue.id);
  const grey = items.find((i) => i.status === 'unavailable' && i.title);
  if (grey) {
    const r = await actions.findReplacements(yt, grey);
    await log(`OK   findReplacements: ${r.length} candidates, best ${r[0]?.title} (${r[0]?.type}, ${Math.round((r[0]?.score ?? 0) * 100)}%)`);
  }
  const clip = items.filter((i) => i.duration && i.duration < 150).sort((a, b) => a.duration! - b.duration!)[0];
  if (clip) {
    const r = await actions.fullVersions(repo, yt, queue.id, clip);
    await log(`OK   fullVersions: ${r.candidates.length} candidates for a ${clip.duration}s clip; queries ${r.queries.length}`);
  }
  const groups = await actions.scanDuplicates(yt, queue.id);
  await log(`OK   scanDuplicates on !Queue: ${groups.length} groups (${groups.filter((g) => g.tier === 'exact').length} exact)`);
  const w = await actions.whereElse(repo, queue.id, false);
  await log(`OK   whereElse: ${w.size} of ${items.length} tracks also elsewhere`);
  const other = lists.find((p) => p.id !== queue.id && !p.hidden && p.total > 0);
  if (other) {
    const c = await actions.compareLists(repo, queue.id, other.id);
    await log(`OK   compareLists vs ${other.title}: only A ${c.onlyA.length}, both ${c.both.length}, only B ${c.onlyB.length}`);
  }
}

/** Creates ONE throwaway playlist, exercises add/replace/remove with the app's own actions, and always deletes it again. */
async function writeTest(yt: import('../services/yt').Yt, repo: import('../services/db').Repo): Promise<void> {
  type Inner = { playlist: { create(t: string, v: string[]): Promise<{ playlist_id: string }> }; actions: { execute(path: string, body: object): Promise<unknown> } };
  const inner = (yt as unknown as { yt: Inner }).yt;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const read = async (id: string, want: number) => {
    for (let i = 0; i < 6; i++) {
      const t = await yt.playlistTracks(id);
      if (t.length === want) return t;
      await wait(1500); // YouTube needs a moment before a new edit shows up
    }
    return yt.playlistTracks(id);
  };
  const track = (videoId: string, title: string) => ({ videoId, title, artists: 'selftest', duration: 200 });
  let id: string | undefined;
  try {
    id = (await inner.playlist.create('Playlist Keeper selftest (safe to delete)', ['mc5epckyC5k'])).playlist_id;
    await log(`OK   created throwaway playlist ${id}`);
    await read(id, 1);
    await syncPlaylist(repo, yt, { id, title: 'Playlist Keeper selftest (safe to delete)' });
    await actions.addTrack(repo, yt, id, track('gITHHRAnCBU', 'Max Payne'));
    await log(`OK   addTrack: ${(await read(id, 2)).length} tracks on YouTube`);
    await actions.replaceTrack(repo, yt, id, 'mc5epckyC5k', track('1l1sXEZFFlc', 'Renegade (from GANGSTA)'), true);
    const after = await read(id, 2);
    await log(`OK   replaceTrack (forced): ${after.map((t) => t.videoId).sort().join(',')} (expected 1l1sXEZFFlc,gITHHRAnCBU)`);
    const dupe = await actions.scanDuplicates(yt, id);
    await log(`     scanDuplicates on the throwaway: ${dupe.length} groups`);
    const n = await actions.removeEntries(repo, yt, id, [after[0]!.setVideoId!]);
    await log(`OK   removeEntries: removed ${n}, ${(await read(id, 1)).length} left on YouTube, ${(await repo.items(id)).filter((i) => i.status === 'ok').length} ok in the local copy`);
  } catch (e) {
    await log(`FAIL write test: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    if (id) {
      await inner.actions.execute('/playlist/delete', { playlistId: id, client: 'YTMUSIC', parse: false }).then(
        () => log('OK   throwaway playlist deleted'),
        (e) => log(`FAIL could not delete throwaway playlist ${id}: ${String(e)}`),
      );
      await repo.forget(id);
    }
  }
}

export async function selftest(): Promise<void> {
  const t0 = performance.now();
  const step = async <T>(name: string, fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      const r = await fn();
      await log(`OK   ${name}`);
      return r;
    } catch (e) {
      await log(`FAIL ${name}: ${e instanceof Error ? e.message : String(e)}`);
      return undefined;
    }
  };
  const repo = await step('open database', () => openRepo());
  if (repo) await log(`     playlists in db: ${(await repo.playlists()).length}`);
  const choices = await step('detect browsers', browserChoices);
  await log(`     default browser: ${choices?.find((c) => c.isDefault)?.browser ?? 'unknown'}`);
  await log(`     firefox signed-in profiles: ${(await profilesOf('firefox')).length}`);
  const mode = String(import.meta.env.VITE_SELFTEST);
  const yt = await step('sign in with Firefox cookies (Rust HTTP + youtubei.js)', () => signInWithBrowserCookies('firefox'));
  if (!yt) return;
  await step('diagnose library response', async () => {
    const page = (await (yt as unknown as { browse(b: object): Promise<unknown> }).browse({ browseId: 'FEmusic_liked_playlists' })) as Record<string, unknown>;
    const text = JSON.stringify(page);
    const logged = /"key":"logged_in","value":"(\d)"/u.exec(text)?.[1];
    await log(`     response: ${text.length} bytes, logged_in=${logged}, top keys=${Object.keys(page).join(',')}, tworow=${text.includes('musicTwoRowItemRenderer')}, signInText=${/sign in/iu.test(text)}`);
  });
  const lib = await step('library playlists', () => yt.libraryPlaylists());
  await log(`     library: ${lib?.length ?? 0} playlists`);
  const small = lib?.find((p) => p.title === '!Queue') ?? lib?.find((p) => (p.count ?? 0) > 0 && (p.count ?? 0) < 400);
  if (small) {
    const tracks = await step(`read a playlist (${small.count} tracks)`, () => yt.playlistTracks(small.id));
    await log(`     read ${tracks?.length ?? 0} tracks, ${tracks?.filter((t) => !t.available).length ?? 0} greyed out, ${tracks?.filter((t) => t.setVideoId).length ?? 0} with setVideoId`);
    await log(`     cleaning works: ${cleanedFields(tracks?.[0]?.title ?? '', tracks?.[0]?.artists ?? '').cleanTitle.length > 0}`);
  }
  const qs = shortQueryVariants('GANGSTA. - Opening | Renegade', 'Crunchyroll');
  const hits = await step('search (song + show query)', async () => Promise.all(qs.map((q) => yt.search(q))));
  if (hits) {
    const top = rankFull({ videoId: 'clip', duration: 90 }, qs, hits)[0];
    await log(`     best full version: ${top?.title} by ${top?.artists}, ${top?.duration}s, score ${top?.score}`);
  }
  if (repo && lib) {
    const t = performance.now();
    const only = { libraryPlaylists: async () => lib.filter((p) => p.title === small?.title), playlistTracks: (id: string) => yt.playlistTracks(id) };
    const r = await step('sync one playlist into the database', () => syncAll(repo, only));
    await log(`     synced ${r?.synced}, skipped ${r?.skipped.length} in ${((performance.now() - t) / 1000).toFixed(1)}s`);
    const pl = (await repo.playlists()).find((p) => p.title === small?.title);
    await log(`     db now: ${pl?.total} tracks, ${pl?.missing} greyed out or removed`);
  }
  if (repo) await actionChecks(repo, yt);
  if (mode === 'write' && repo) await writeTest(yt, repo);
  await log(`done in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
}
