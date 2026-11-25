# How I test against an API that has no docs

Playlist Keeper reads YouTube Music the way a browser does. There is no public API for it, so nothing promises that
tomorrow's response looks like today's. This is how I made that survivable.

## The problem

YouTube Music answers with a deeply nested JSON tree. The two fields the app needs most, the "greyed out" flag and the
id that lets you remove one copy of a repeated song, are dropped by the popular client library, so I read the raw
responses myself. That means I own the parsing, and I own the day it breaks.

## What I did

**Search for shapes, not paths.** The parsers find objects by their key anywhere in the tree instead of following a fixed
path like `contents.a.b.c`. A small layout change that moves a shelf one level deeper does not break them.

**Refuse to guess.** If a page does not contain the structure I know, the parser returns nothing. It never picks "the
closest thing". A test pins this down: a page with track rows under an unknown key must produce zero tracks.

**Treat "nothing" as suspicious.** For a backup tool the dangerous bug is not a crash, it is quietly concluding that
everything was deleted. So an empty answer for a playlist I already know about is handled as a failed read, and the saved
copy is kept.

**A health check that tells a format change from a normal problem.** When a page loses its known layout, or has track rows
but none can be read, sync raises a specific error instead of saving garbage. One strange playlist, such as an auto-generated
mix, is just skipped. If nothing at all can be read, the whole sync stops with a message that says YouTube probably changed
its API, and that the saved playlists are untouched.

**Contract tests on saved responses.** `tests/contract.test.ts` runs the parsers over JSON files in the shape YouTube
returns and checks every field: ids, grey-out flag, artists, durations, the next-page token. When YouTube changes, the
fix starts by replacing a fixture with a fresh capture. `scripts/make-fixture.mjs` does the tedious part: it strips tracking
and account data and trims the response to a handful of rows, always keeping a greyed-out one.

**Two sources for one fact.** A track greyed out on YouTube Music is sometimes still playable on youtube.com. The app
checks both and labels the difference, so "gone" means gone.

## A bug I only found by using it

Sync added and updated playlists but never removed one I had deleted on YouTube, so deleted playlists stayed in the
list forever. No test covered it because I had never thought to write one. The fix is a few lines. The work was deciding when removing is safe: an empty library answer is treated as a
failed read and removes nothing, and there is a test for exactly that.

## What I would do differently

The fixtures in the repo are trimmed by hand to the response shape. Recording real ones from a live account is the next
step, and the script and the README guide make it a short job. Until then the contract test proves the parsers match
the shape I believe YouTube sends, not that YouTube still sends it. The health check is the safety net for that gap: it
turns a silent failure into a clear message.

## The takeaway

With an API you do not control, the tests are only half the answer. The other half is deciding what the program does when
the ground moves: stop, keep what you have, and say so.
