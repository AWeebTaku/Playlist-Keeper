# Recorded YouTube Music responses

`playlist-page.json` and `library-page.json` are trimmed to the fields the parsers read, in the shape YouTube Music's
`/browse` endpoint returns. When YouTube changes its private API and sync reports an unreadable format, replace a file
with a fresh response (browser dev tools > Network > a `browse` request on music.youtube.com > Response), remove personal
data, and fix `src/services/parse.ts` until `tests/contract.test.ts` passes again.
