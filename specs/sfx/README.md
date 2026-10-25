# Sound download checklist (WP15U)

Your job: for each sound in `specs/sfx/list.md`, open the candidate links, listen, download the best one, save it under the exact name, and log it in `sources.csv`. About 22 sounds, 20-30 minutes. Nothing else is needed from you; WP16 trims, cuts and normalises.

## Steps

1. Create the folder `art-incoming/sfx/` at the repo root (it is gitignored, so nothing here is committed).
2. For each sound in `list.md`, in the order of the "Import table":
   1. Open the rank 1 link and listen. Play it a few times; imagine it 10 times a second for `gun`, three times in a row for `countdown`.
   2. If it passes, use the Download button on the page. MP3 or WAV, both work. If it fails, try rank 2, then rank 3. If all three fail, note the name and tell the brain; do not pick from elsewhere without telling it.
   3. Read the licence line next to the Download button. It must say `Free for use under the Pixabay Content License`.
   4. Save the file as `art-incoming/sfx/<name>.<ext>` with the exact `name` from the table (case matters), for example `art-incoming/sfx/gun.mp3`, `art-incoming/sfx/explosionWreck.wav`. One file per name, no spaces, no suffixes like `(1)`.
   5. Add one line to `art-incoming/sfx/sources.csv`.
3. Check that every "required" name has a file and a CSV line. `skid` is optional: add it only if it loops cleanly, else leave it out and the game keeps the synth skid.

## sources.csv

Plain text, UTF-8, first line is the header exactly as below. One line per saved file. Put the title in double quotes if it contains a comma. No extra columns.

```
name,url,title,licence
gun,https://pixabay.com/sound-effects/film-special-effects-gunshot-352466/,Gunshot,Pixabay Content License
```

| Column | Value |
|---|---|
| `name` | the file stem you saved, exactly as in `list.md` (no extension) |
| `url` | the Pixabay page URL of the sound you downloaded (not the CDN file link) |
| `title` | the title shown on that page |
| `licence` | `Pixabay Content License` if the page says `Free for use under the Pixabay Content License`. Anything else: write what the page says and tell the brain; WP16 refuses it unless it is explicitly accepted |

## Reject a candidate and take the next one if

- there is a music bed, a voice or spoken words;
- a long reverb tail or a room echo (we want dry and close);
- it clips or sounds distorted in a bad way (a gritty crunch is fine, digital splatter is not);
- the wrong character: too sci-fi, too cartoony, too clean or too thin for a gritty dusk scrapyard;
- the licence is not the Pixabay Content License, or the page asks for attribution or a credit line;
- the sound you want comes after a long silence or after several unrelated sounds (WP16 keeps only the start of the file; see the note in `list.md`).

## Notes

- The target lengths in `list.md` are what WP16 cuts to. A longer file is fine when the wanted sound is at the start. A multi-beep file is fine for `countdown` and `mineBeep` (WP16 keeps the first beep) but not for `raceStart` (see its note).
- WP16 reads `art-incoming/sfx/sources.csv` and `specs/sfx/list.md`; it exits with an error on a missing file, an unknown licence, or if the total passes 1.5 MB, so double check the names.
- Do not edit `list.md` or the code. If a link is dead or a sound simply does not exist, tell the brain.
