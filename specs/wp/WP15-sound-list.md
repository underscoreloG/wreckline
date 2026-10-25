# WP15 - Sound list (Pixabay picks)

**Wave C1 (after the fun gate, unless the user moves it), parallel with WP09, WP11, WP13.** Goal: a ready-to-use shopping list so the user can download every recorded sound from Pixabay in one sitting, with nothing left to judge but "does it sound right".
Read first: `SPEC.md`, `specs/wp/WP05-input-audio.md` (what each sound is for), `src/audio/sfx.ts` (`SFX_NAMES` and the current synth recipes), `specs/design.md` (art direction: gritty scrapyard, Death Rally feel), the ledger note "From WP05" in `specs/STATUS.md`.
Depends on: M1 gate passed (go), unless the user pulls sound forward.
Owns: `specs/sfx/**`. Anything else needs a CCR.
Dispatch: subagent (sonnet, effort high: web research). Uses the built-in browser to search https://pixabay.com/sound-effects/ (read-only: no account, no downloads, no cookie consent beyond declining non-essential).

## Scope: which sounds get a recording

| Sound | Recorded (Pixabay) | Why |
|---|---|---|
| `gun`, `overheat`, `explosionWreck`, `explosionMine`, `impact` | yes | the combat feel; hardest to synthesise convincingly |
| `turbo`, `pickupCash`, `pickupRepair`, `pickupMines`, `pickupTurbo`, `mineBeep` | yes | short, easy to find, big polish gain |
| `countdown`, `raceStart`, `uiMove`, `uiConfirm`, `uiBack`, `uiBuy`, `uiError` | yes | UI and race-start cues |
| `skid` | optional loop | only if a clean seamless tire-squeal loop exists; else keep synth |
| `engine`, `engineTurbo` | no | a recorded loop pitch-shifted over the whole rev range sounds worse than the synth; stays synth |
| new: `lapCompleted`, `carDamaged` (player only), `mineDropped` | yes | WP05 had no recipe for them (silent today) |

## Deliverables
- `specs/sfx/list.md`: one row per recorded sound: name, what it must sound like (one line, gritty and arcade, matching the dusk scrapyard), target length (one-shots 0.1-1.5 s, explosions up to 2.5 s, loops 1-3 s seamless), mono or stereo, and **2-3 candidate Pixabay links** per sound found by searching, each with its title, duration and the search terms that found it, ranked. Prefer short, dry, close-miked sounds without music, voice or long reverb tails.
- For each candidate, the licence line shown on its page (Pixabay Content License or other) copied verbatim, and a flag if it is anything other than the Pixabay Content License or needs attribution. Never assume the licence: read it on the page.
- `specs/sfx/README.md`: the user's checklist (WP15U): open each link, listen, download the best one as MP3 or WAV, save it as `art-incoming/sfx/<name>.<ext>` (exact names from `list.md`), and fill `art-incoming/sfx/sources.csv` (`name,url,title,licence`). Reject and pick the next candidate if: music bed, voice, long reverb, clipping, or the licence is not the Pixabay Content License.

## Acceptance tests
- [ ] `list.md` covers every "yes" row above; each has >= 2 candidate links that open a Pixabay sound page (the report lists the HTTP status of each link checked with the browser) and a copied licence line.
- [ ] README file names and the CSV columns match exactly what WP16's import script reads.

## Out of scope
Downloading (the user does it), music, voice lines, editing audio, any game code.

---

# WP15U - Download the sounds (user step)

Dispatch: `user:Pixabay` (browser, the user's own session). The brain hands the user `specs/sfx/README.md`; ledger `waiting-user`. Done when every "yes" sound of `list.md` sits in `art-incoming/sfx/` and `sources.csv` lists each with its URL and licence. The user checks each licence while downloading.
