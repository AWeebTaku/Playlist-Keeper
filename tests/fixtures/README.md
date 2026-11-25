# Recorded YouTube Music responses

`playlist-page.json` and `library-page.json` are trimmed to the fields the parsers read, in the shape YouTube Music's
`/browse` endpoint returns. **They are currently hand-written to that shape, not captures of a real account.** To replace one
with a real response, follow "Recording real test responses" in the main README: save a `browse` response from the browser's
dev tools, run `node scripts/make-fixture.mjs <file> playlist|library`, read the result for personal data, then `npm test`.
When YouTube changes its private API and sync reports an unreadable format, do the same with a fresh response and fix
`src/services/parse.ts` until `tests/contract.test.ts` passes again.
