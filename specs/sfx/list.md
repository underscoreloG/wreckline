# Sound list (WP15)

Shopping list for the recorded sounds, checked in the built-in browser on 2026-10-25. 22 sounds, 66 candidate links, each ranked best first. Every candidate page returned HTTP 200 and shows the licence line below.

Licence line copied from every candidate page: `Free for use under the Pixabay Content License`. No candidate asks for attribution, and none shows another licence. Still re-read it on the page when you download.

What was NOT done: nobody has listened to these. Ranking comes from title, page description, tags and measured file length. Audition each candidate; if rank 1 sounds wrong, take rank 2.

Length column: the preview file's duration measured in the browser (the page itself only shows whole seconds). WP16 trims silence at the start and end and cuts to the target length, so a longer file is fine if the sound happens first. Search words are Pixabay sound-effects searches at `https://pixabay.com/sound-effects/search/<words>/`.

## Import table (WP16 reads this)

One row per sound. Do not reorder or rename columns. `name` is the file stem you save as `art-incoming/sfx/<name>.mp3` or `.wav`. `category` drives the loudness matching (`combat`, `pickups`, `ui`; `loops` for loops). `kind` is `oneshot` or `loop`. `target_s` is the length WP16 cuts to (loops: loop length). `channels` is the output (`mono` for all: the game pans with a StereoPanner).

| name | category | kind | target_s | channels |
|---|---|---|---|---|
| gun | combat | oneshot | 0.3 | mono |
| overheat | combat | oneshot | 0.5 | mono |
| explosionWreck | combat | oneshot | 2.5 | mono |
| explosionMine | combat | oneshot | 1.5 | mono |
| impact | combat | oneshot | 0.4 | mono |
| mineBeep | combat | oneshot | 0.1 | mono |
| pickupCash | pickups | oneshot | 0.35 | mono |
| pickupRepair | pickups | oneshot | 0.4 | mono |
| pickupMines | pickups | oneshot | 0.3 | mono |
| pickupTurbo | pickups | oneshot | 0.4 | mono |
| turbo | combat | oneshot | 1.0 | mono |
| countdown | ui | oneshot | 0.2 | mono |
| raceStart | ui | oneshot | 0.5 | mono |
| uiMove | ui | oneshot | 0.1 | mono |
| uiConfirm | ui | oneshot | 0.2 | mono |
| uiBack | ui | oneshot | 0.2 | mono |
| uiBuy | ui | oneshot | 0.5 | mono |
| uiError | ui | oneshot | 0.25 | mono |
| skid | loops | loop | 2.0 | mono |
| lapCompleted | ui | oneshot | 1.0 | mono |
| carDamaged | combat | oneshot | 0.4 | mono |
| mineDropped | combat | oneshot | 0.3 | mono |

`skid` is optional: if you find no clean loop, leave it out and the game keeps the synth skid. All other 21 rows are required.

`engine` and `engineTurbo` stay synth and are not listed.

## Candidates

### gun

- Use: Player and AI gun shot, rapid fire.
- Must sound like: Dry, snappy single machine-gun crack, close-miked, almost no tail. Must not turn to mush when fired in rapid succession.
- Target: 0.3 s, oneshot, mono, category combat. Save as `art-incoming/sfx/gun.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Gunshot | Universfield | 1.06 s | https://pixabay.com/sound-effects/film-special-effects-gunshot-352466/ | gunshot dry; pistol shot | Free for use under the Pixabay Content License | 200 | Page says 'powerful and sharp'; no reverb mentioned. Listen for tail. |
| 2 | 9mm pistol shoot short reverb | freesound_community | 1.49 s | https://pixabay.com/sound-effects/film-special-effects-9mm-pistol-shoot-short-reverb-7152/ | pistol shot | Free for use under the Pixabay Content License | 200 | Title says short reverb tail; WP16 cuts it at 0.3 s, so usually fine. |
| 3 | Semi Automatic Rifle/Pistol Shot | Dev_Guy | 0.57 s | https://pixabay.com/sound-effects/film-special-effects-semi-automatic-riflepistol-shot-389472/ | pistol shot | Free for use under the Pixabay Content License | 200 | Shortest of the three (0.57 s). |

### overheat

- Use: Gun overheats and cuts out.
- Must sound like: Short descending mechanical wind-down plus a hot steam hiss, no voice.
- Target: 0.5 s, oneshot, mono, category combat. Save as `art-incoming/sfx/overheat.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | minigun_Overheat | freesound_community | 1.54 s | https://pixabay.com/sound-effects/film-special-effects-minigun-overheat-84899/ | overheat; weapon overheat | Free for use under the Pixabay Content License | 200 | Minigun spin-down with steam hiss: closest match to the intent. |
| 2 | Steam Hissing | DRAGON-STUDIO | 1.10 s | https://pixabay.com/sound-effects/film-special-effects-steam-hissing-386157/ | steam hiss release | Free for use under the Pixabay Content License | 200 | Pure hiss; WP16 keeps the first 0.5 s. |
| 3 | Air | freesound_community | 0.60 s | https://pixabay.com/sound-effects/film-special-effects-air-84482/ | air horn short (side result) | Free for use under the Pixabay Content License | 200 | Short compressed-air hiss, 0.6 s. |

### explosionWreck

- Use: A car is wrecked. The biggest sound in the game.
- Must sound like: Heavy boom with a gritty debris crumble, fast attack, tail cut at 2.5 s.
- Target: 2.5 s, oneshot, mono, category combat. Save as `art-incoming/sfx/explosionWreck.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Explosion with Debris | DRAGON-STUDIO | 2.90 s | https://pixabay.com/sound-effects/horror-explosion-with-debris-494320/ | explosion debris | Free for use under the Pixabay Content License | 200 | Description: explosion with falling debris. Top pick for the scrapyard. |
| 2 | Grenade Explosion 14 | DavidDumaisAudio | 2.16 s | https://pixabay.com/sound-effects/film-special-effects-grenade-explosion-14-190266/ | grenade explosion | Free for use under the Pixabay Content License | 200 | Game-oriented grenade blast, 2.2 s. |
| 3 | HQ Explosion | freesound_community | 2.82 s | https://pixabay.com/sound-effects/film-special-effects-hq-explosion-6288/ | grenade explosion | Free for use under the Pixabay Content License | 200 | Bass-heavy with debris; 2.8 s, WP16 trims the tail. |

### explosionMine

- Use: A mine detonates. Smaller and punchier than a wreck.
- Must sound like: Short punchy bang with a little debris, almost no rumble tail.
- Target: 1.5 s, oneshot, mono, category combat. Save as `art-incoming/sfx/explosionMine.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | small explosion | freesound_community | 1.08 s | https://pixabay.com/sound-effects/film-special-effects-small-explosion-103779/ | small explosion | Free for use under the Pixabay Content License | 200 | 1.1 s, shortest; tagged 'Pop, Paper' so check it is not too thin. |
| 2 | small explosion | DennisH18 | 1.23 s | https://pixabay.com/sound-effects/film-special-effects-small-explosion-129477/ | small explosion | Free for use under the Pixabay Content License | 200 | Description: deep impact with debris rumble. |
| 3 | Small Explosion | freesound_community | 1.51 s | https://pixabay.com/sound-effects/film-special-effects-small-explosion-103931/ | small explosion | Free for use under the Pixabay Content License | 200 | Punchy and dynamic per page; 1.5 s. |

### impact

- Use: Car hits a wall or another car. Volume follows speed.
- Must sound like: Short dull metal clank and crunch, dry, no ring-out.
- Target: 0.4 s, oneshot, mono, category combat. Save as `art-incoming/sfx/impact.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Metal Hit | Universfield | 1.15 s | https://pixabay.com/sound-effects/film-special-effects-metal-hit-153323/ | metal impact | Free for use under the Pixabay Content License | 200 | Sharp metallic hit; 1.2 s, WP16 keeps the first 0.4 s. |
| 2 | Clank Car Crash Collision | freesound_community | 0.60 s | https://pixabay.com/sound-effects/film-special-effects-clank-car-crash-collision-6206/ | car hit | Free for use under the Pixabay Content License | 200 | Heavy metallic car collision, 0.6 s. |
| 3 | Bullet Hit Metal | freesound_community | 1.34 s | https://pixabay.com/sound-effects/film-special-effects-bullet-hit-metal-84818/ | metal hit | Free for use under the Pixabay Content License | 200 | Bullet hit on metal: tighter, more clang. |

### mineBeep

- Use: Armed mine blinks audibly when the player is within 20 m (every 0.5 s).
- Must sound like: One short dry electronic blip, no decay tail.
- Target: 0.1 s, oneshot, mono, category combat. Save as `art-incoming/sfx/mineBeep.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Beep | u_edtmwfwu7c | 1.46 s | https://pixabay.com/sound-effects/film-special-effects-beep-329314/ | mine beep | Free for use under the Pixabay Content License | 200 | Keyword 'Beep Once'; 1.5 s file, silence is trimmed. |
| 2 | Beep warning | freesound_community | 1.75 s | https://pixabay.com/sound-effects/film-special-effects-beep-warning-6387/ | alarm beep | Free for use under the Pixabay Content License | 200 | Beep warning; take the first beep only. |
| 3 | beep alarm | u_8quitk9nqe | 3.48 s | https://pixabay.com/sound-effects/film-special-effects-beep-alarm-366507/ | alarm beep | Free for use under the Pixabay Content License | 200 | Retro alarm beep; file holds repeats, WP16 keeps the first. |

### pickupCash

- Use: Cash pickup.
- Must sound like: Bright arcade coin ding, rising, very short.
- Target: 0.35 s, oneshot, mono, category pickups. Save as `art-incoming/sfx/pickupCash.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Coin Pickup | freesound_community | 1.97 s | https://pixabay.com/sound-effects/film-special-effects-coin-pickup-98269/ | coin pickup | Free for use under the Pixabay Content License | 200 | 8-bit coin, 2 s file with tail, WP16 keeps the first 0.35 s. |
| 2 | Retro Arcade Coin Pickup | Vadim_Makes_Sound | 0.65 s | https://pixabay.com/sound-effects/film-special-effects-retro-arcade-coin-pickup-622953/ | coin pickup | Free for use under the Pixabay Content License | 200 | 0.65 s, retro arcade coin. |
| 3 | 8-Bit Retro Coin | KRNBEATZ | 1.04 s | https://pixabay.com/sound-effects/film-special-effects-8-bit-retro-coin-584191/ | coin pickup | Free for use under the Pixabay Content License | 200 | 8-bit chiptune coin. |

### pickupRepair

- Use: Repair kit pickup.
- Must sound like: Short metallic wrench ratchet or hammer clink: workshop, not magic.
- Target: 0.4 s, oneshot, mono, category pickups. Save as `art-incoming/sfx/pickupRepair.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Repair_metal | freesound_community | 1.63 s | https://pixabay.com/sound-effects/film-special-effects-repair-metal-85833/ | repair | Free for use under the Pixabay Content License | 200 | Rhythmic metal hammering; 1.6 s, first hit(s) kept. |
| 2 | ratchet socket wrench tool | freesound_community | 1.34 s | https://pixabay.com/sound-effects/film-special-effects-ratchet-socket-wrench-tool-95253/ | ratchet | Free for use under the Pixabay Content License | 200 | Ratchet socket wrench: crisp clicks. |
| 3 | wrench 02 | freesound_community | 0.70 s | https://pixabay.com/sound-effects/film-special-effects-wrench-02-101112/ | repair wrench | Free for use under the Pixabay Content License | 200 | Short wrench click, 0.7 s. |

### pickupMines

- Use: Mine ammo pickup.
- Must sound like: Mechanical clack of a magazine or mine casing sliding home.
- Target: 0.3 s, oneshot, mono, category pickups. Save as `art-incoming/sfx/pickupMines.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Magazine Slide | freesound_community | 1.13 s | https://pixabay.com/sound-effects/film-special-effects-magazine-slide-100131/ | magazine insert | Free for use under the Pixabay Content License | 200 | Magazine slides and clicks into place. |
| 2 | Gun Mag Insert 1 | FreeSounds-4U | 1.63 s | https://pixabay.com/sound-effects/film-special-effects-gun-mag-insert-1-395178/ | magazine insert | Free for use under the Pixabay Content License | 200 | Gun mag insert, 1.6 s with tail. |
| 3 | Gun Mag Insert 2 | FreeSounds-4U | 1.92 s | https://pixabay.com/sound-effects/film-special-effects-gun-mag-insert-2-395172/ | magazine insert | Free for use under the Pixabay Content License | 200 | Gun mag insert 2. |

### pickupTurbo

- Use: Turbo charge pickup.
- Must sound like: Fast rising electronic power-up zip, arcade.
- Target: 0.4 s, oneshot, mono, category pickups. Save as `art-incoming/sfx/pickupTurbo.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Power Up 01A | EdR | 1.04 s | https://pixabay.com/sound-effects/film-special-effects-power-up-01a-484722/ | power up pickup | Free for use under the Pixabay Content License | 200 | 8-bit rising tone. |
| 2 | Retro Arcade Power Up | Vadim_Makes_Sound | 0.79 s | https://pixabay.com/sound-effects/film-special-effects-retro-arcade-power-up-622944/ | power up pickup | Free for use under the Pixabay Content License | 200 | Retro arcade power-up, 0.8 s. |
| 3 | powerup success | Tithuh | 0.97 s | https://pixabay.com/sound-effects/film-special-effects-powerup-success-523645/ | upgrade | Free for use under the Pixabay Content License | 200 | Power-up success, 1.0 s; check it is not a melody. |

### turbo

- Use: Turbo activates (whoosh over the engine).
- Must sound like: Short gritty air-and-flame boost whoosh with a quick onset, no melody.
- Target: 1.0 s, oneshot, mono, category combat. Save as `art-incoming/sfx/turbo.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Nitro Activation | freesound_community | 2.74 s | https://pixabay.com/sound-effects/film-special-effects-nitro-activation-48077/ | engine boost | Free for use under the Pixabay Content License | 200 | Nitro activation with acceleration; 2.7 s, WP16 keeps the first 1 s. |
| 2 | Boost | freesound_community | 1.80 s | https://pixabay.com/sound-effects/film-special-effects-boost-100537/ | turbo boost | Free for use under the Pixabay Content License | 200 | Electronic boost; check it is not too sci-fi. |
| 3 | Futuristic Zoom Whoosh 1 | floraphonic | 2.26 s | https://pixabay.com/sound-effects/film-special-effects-futuristic-zoom-whoosh-1-183976/ | rocket whoosh | Free for use under the Pixabay Content License | 200 | Fast zoom whoosh; sci-fi flavour. |

### countdown

- Use: Race countdown 3, 2, 1 (same sound three times).
- Must sound like: One clean medium-pitch beep, 0.2 s, no decay.
- Target: 0.2 s, oneshot, mono, category ui. Save as `art-incoming/sfx/countdown.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Digital Beep | Universfield | 1.72 s | https://pixabay.com/sound-effects/film-special-effects-digital-beep-151921/ | mine beep | Free for use under the Pixabay Content License | 200 | Short clean digital beep. |
| 2 | Beep | emircanalp | 1.62 s | https://pixabay.com/sound-effects/film-special-effects-beep-125033/ | mine beep | Free for use under the Pixabay Content License | 200 | Short digital beep. |
| 3 | Short beep countdown | freesound_community | 3.53 s | https://pixabay.com/sound-effects/film-special-effects-short-beep-countdown-81121/ | countdown beep | Free for use under the Pixabay Content License | 200 | Holds several beeps; WP16 keeps the first beep only. |

### raceStart

- Use: GO cue after the countdown.
- Must sound like: One higher, longer beep or short air-horn blast, 0.5 s. Must differ clearly from countdown.
- Target: 0.5 s, oneshot, mono, category ui. Save as `art-incoming/sfx/raceStart.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Realistic Air Horn Sound Effect Short | hums | 0.84 s | https://pixabay.com/sound-effects/film-special-effects-realistic-air-horn-sound-effect-short-274181/ | air horn short | Free for use under the Pixabay Content License | 200 | Short realistic air horn, 0.84 s. |
| 2 | Automobile Horn 02 | Universfield | 1.25 s | https://pixabay.com/sound-effects/film-special-effects-automobile-horn-02-352065/ | starting horn | Free for use under the Pixabay Content License | 200 | Single car horn honk, 1.25 s. |
| 3 | Race Start Beeps | transcendedlifting | 4.05 s | https://pixabay.com/sound-effects/film-special-effects-race-start-beeps-125125/ | race start | Free for use under the Pixabay Content License | 200 | WEAK: 4 s of race start beeps. WP16 would keep the FIRST beep, so use only if its first tone is the long one; otherwise skip. |

### uiMove

- Use: Menu cursor move.
- Must sound like: Soft short tick or hover blip, barely there.
- Target: 0.1 s, oneshot, mono, category ui. Save as `art-incoming/sfx/uiMove.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Menu Click | Universfield | 0.84 s | https://pixabay.com/sound-effects/film-special-effects-menu-click-147357/ | menu select | Free for use under the Pixabay Content License | 200 | Subtle clean menu click. |
| 2 | Minimalist Button Hover Sound Effect | Lesiakower | 0.74 s | https://pixabay.com/sound-effects/film-special-effects-minimalist-button-hover-sound-effect-399749/ | ui hover | Free for use under the Pixabay Content License | 200 | Minimalist hover. |
| 3 | UI Hover SFX | LitUpSubway | 0.71 s | https://pixabay.com/sound-effects/technology-ui-hover-sfx-513360/ | ui hover | Free for use under the Pixabay Content License | 200 | Game menu hover. |

### uiConfirm

- Use: Menu confirm.
- Must sound like: Short bright two-step 'yes' blip going up.
- Target: 0.2 s, oneshot, mono, category ui. Save as `art-incoming/sfx/uiConfirm.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Video Game Select | CreatorsHome | 0.89 s | https://pixabay.com/sound-effects/film-special-effects-video-game-select-337214/ | menu select | Free for use under the Pixabay Content License | 200 | Retro menu select. |
| 2 | Select 003 | CreatorsHome | 1.49 s | https://pixabay.com/sound-effects/film-special-effects-select-003-337609/ | menu select | Free for use under the Pixabay Content License | 200 | Clean select click. |
| 3 | Positive Notification | Universfield | 1.08 s | https://pixabay.com/sound-effects/film-special-effects-positive-notification-351299/ | success short | Free for use under the Pixabay Content License | 200 | Bright positive notification; may be too soft or musical. |

### uiBack

- Use: Menu back or cancel.
- Must sound like: Short soft two-step blip going down.
- Target: 0.2 s, oneshot, mono, category ui. Save as `art-incoming/sfx/uiBack.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | UI back sound | freesound_community | 0.74 s | https://pixabay.com/sound-effects/film-special-effects-ui-back-sound-100590/ | ui back | Free for use under the Pixabay Content License | 200 | Clean UI back click. |
| 2 | Back | freesound_gamestudio | 0.68 s | https://pixabay.com/sound-effects/film-special-effects-back-408405/ | ui back | Free for use under the Pixabay Content License | 200 | Game 'Back' sound. |
| 3 | Cancel_Back UI (1) | Yodguard | 1.54 s | https://pixabay.com/sound-effects/film-special-effects-cancel-back-ui-1-540204/ | ui back | Free for use under the Pixabay Content License | 200 | Cancel sound, 1.5 s file, WP16 trims. |

### uiBuy

- Use: Shop purchase.
- Must sound like: Quick cash-register 'ka-ching', short, dry.
- Target: 0.5 s, oneshot, mono, category ui. Save as `art-incoming/sfx/uiBuy.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Purchase Success | freesound_gamestudio | 1.41 s | https://pixabay.com/sound-effects/film-special-effects-purchase-success-384963/ | purchase | Free for use under the Pixabay Content License | 200 | Purchase success. |
| 2 | Cash Register Kaching | DRAGON-STUDIO | 1.10 s | https://pixabay.com/sound-effects/film-special-effects-cash-register-kaching-376867/ | cash register | Free for use under the Pixabay Content License | 200 | Cash register kaching, 1.1 s. |
| 3 | Retro Cash Register Ka-Ching With Coin Drawer #1 | Vadim_Makes_Sound | 3.02 s | https://pixabay.com/sound-effects/film-special-effects-retro-cash-register-ka-ching-with-coin-drawer-1-546555/ | purchase | Free for use under the Pixabay Content License | 200 | Retro ka-ching with drawer; 3 s file, WP16 keeps the first 0.5 s. |

### uiError

- Use: Not enough cash, locked item.
- Must sound like: Low dry buzz, about 120 Hz, harsh, no melody.
- Target: 0.25 s, oneshot, mono, category ui. Save as `art-incoming/sfx/uiError.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Low UI Error Buzz | Turning_Pages | 0.46 s | https://pixabay.com/sound-effects/technology-low-ui-error-buzz-608634/ | error buzz | Free for use under the Pixabay Content License | 200 | Low UI error buzz, 0.46 s: best match to the 120 Hz idea. |
| 2 | error_sound | rikk_nextsoft | 1.07 s | https://pixabay.com/sound-effects/film-special-effects-error-sound-221445/ | error buzz | Free for use under the Pixabay Content License | 200 | Digital error buzzer. |
| 3 | UI Error Denied Sound #2 | Vadim_Makes_Sound | 1.03 s | https://pixabay.com/sound-effects/technology-ui-error-denied-sound-2-547856/ | ui error | Free for use under the Pixabay Content License | 200 | Error beep, denied. |

### skid

- Use: OPTIONAL. Tire squeal while drifting. Only use if it loops cleanly, else keep the synth.
- Must sound like: Steady rubber squeal with no pitch glide and no start or end event, loops without a click.
- Target: 2.0 s, loop, mono, category loops. Save as `art-incoming/sfx/skid.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Rubber Tire Screech 4 | floraphonic | 1.37 s | https://pixabay.com/sound-effects/film-special-effects-rubber-tire-screech-4-202533/ | car scrape; tire screech | Free for use under the Pixabay Content License | 200 | 1.4 s single screech; not a loop by itself, listen for loopability. |
| 2 | Rubber Tire Screech 7 | floraphonic | 1.08 s | https://pixabay.com/sound-effects/film-special-effects-rubber-tire-screech-7-202580/ | tire screech | Free for use under the Pixabay Content License | 200 | 1.1 s single screech, same caveat. |
| 3 | Chrysler LHS tire squeal 03 (04-25-2009) | freesound_community | 13.85 s | https://pixabay.com/sound-effects/city-chrysler-lhs-tire-squeal-03-04-25-2009-7154/ | tire squeal | Free for use under the Pixabay Content License | 200 | 13.9 s sustained squeal: take a steady part; WP16 crops from the start, so it may need a clean start. |

### lapCompleted

- Use: NEW. Player finishes a lap.
- Must sound like: Short bright chime or bell ding, one gesture, no melody run.
- Target: 1.0 s, oneshot, mono, category ui. Save as `art-incoming/sfx/lapCompleted.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Level Complete | Universfield | 1.96 s | https://pixabay.com/sound-effects/film-special-effects-level-complete-143022/ | lap complete | Free for use under the Pixabay Content License | 200 | Level complete jingle, 2 s; WP16 keeps the first 1 s. |
| 2 | Ding small bell sfx | OxidVideos | 0.70 s | https://pixabay.com/sound-effects/film-special-effects-ding-small-bell-sfx-411945/ | bell ding | Free for use under the Pixabay Content License | 200 | Small bell ding, 0.7 s. |
| 3 | Success | UpdatePelgo | 2.12 s | https://pixabay.com/sound-effects/film-special-effects-success-221935/ | lap complete | Free for use under the Pixabay Content License | 200 | Success chime, 2.1 s. |

### carDamaged

- Use: NEW. Player car takes a hit (rate-limited to 1 per 0.25 s).
- Must sound like: Short crunchy metal hit, close, no voice.
- Target: 0.4 s, oneshot, mono, category combat. Save as `art-incoming/sfx/carDamaged.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | Metal crunch | u_y3wk5ympz8 | 0.53 s | https://pixabay.com/sound-effects/film-special-effects-metal-crunch-263638/ | metal crunch | Free for use under the Pixabay Content License | 200 | Metal crunch and impact, 0.5 s. |
| 2 | Impact • Metal Bullet Hit Clang | Vadim_Makes_Sound | 0.16 s | https://pixabay.com/sound-effects/film-special-effects-impact-metal-bullet-hit-clang-601139/ | hit damage | Free for use under the Pixabay Content License | 200 | Metal bullet hit clang, 0.16 s: very short, fine for rapid hits. |
| 3 | damage | freesound_community | 2.64 s | https://pixabay.com/sound-effects/film-special-effects-damage-40114/ | hit damage | Free for use under the Pixabay Content License | 200 | Game damage hit, 2.6 s file, WP16 keeps the first 0.4 s. |

### mineDropped

- Use: NEW. Player drops a mine behind the car.
- Must sound like: Short metallic clunk or plop of an object set down on the road.
- Target: 0.3 s, oneshot, mono, category combat. Save as `art-incoming/sfx/mineDropped.<ext>`.

| Rank | Title (as shown) | Author | File length | URL | Found with | Licence line | HTTP | Note |
|---|---|---|---|---|---|---|---|---|
| 1 | put_item | freesound_community | 0.62 s | https://pixabay.com/sound-effects/film-special-effects-put-item-83043/ | place item | Free for use under the Pixabay Content License | 200 | Placing or dropping an item, 0.6 s (binaural, folded to mono). |
| 2 | Locked Door (4) | Yodguard | 1.03 s | https://pixabay.com/sound-effects/film-special-effects-locked-door-4-540180/ | metal clunk | Free for use under the Pixabay Content License | 200 | Door lock metal clunk. |
| 3 | LightClunk1 | freesound_community | 0.42 s | https://pixabay.com/sound-effects/film-special-effects-lightclunk1-107615/ | metal clunk | Free for use under the Pixabay Content License | 200 | Light mechanical clunk, 0.42 s. |

## Link check

2026-10-25, built-in browser, read-only. Each of the 66 candidate URLs above was fetched twice (candidate discovery, then again from the final URL list): 66 of 66 returned HTTP 200 both times. The licence element on each page read exactly `Free for use under the Pixabay Content License` (66 of 66); no page body mentions attribution or a required credit. One page (494320) was also opened as a full navigation: HTTP 200 and the rendered licence line matched. Pixabay rate-limited the browser once (HTTP 429, a Cloudflare 'Just a moment' page) during discovery; the checks were paced after that and nothing was bypassed.
