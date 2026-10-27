# Wreckline career story (draft v1, 2026-10-27)

User request (2026-10-27): "when in career, would it be possible to add some story? Like we should have an endgoal and each race we have some kind of frame with people and stuff behind (related to the race track or whatever) and some kind of conversation going ... and then space to continue. I don't want any voice, just a frame with some text below like the old game."

Decisions (user, 2026-10-27): end goal = take down THE WARDEN; story beats at rank milestones + one scene per track (about 16 images); tone grim and funny (Death Rally); art 90s painted pixel art; THE WARDEN took the family garage; an old mechanic talks before races; 4 rivals become named lieutenants; scenes type out, SPACE skips, no forced wait.

## 1. Premise

The Wreckline is THE WARDEN's league: twenty drivers, ten tracks, one ladder, and nobody ever retires on their own. Your family ran the **Red Lantern Garage** for forty years. Last winter your father bet the garage on one race against THE WARDEN and lost it on the final lap (his brakes "failed"; everybody knows who cut them). THE WARDEN hung the Red Lantern sign over his own pit as a trophy.

All you have left is a rusty RAVEN that MAZ, the family's old mechanic, dragged out of the scrapyard behind the garage, and a bad idea: enter the Wreckline at rank 20, climb to the top, and take the garage back in the one race THE WARDEN never refuses, the title race.

The player is never seen and never speaks: MAZ calls them "kid". Rivals call them "Lantern" (after the garage), and THE WARDEN calls them "the mechanic's stray".

## 2. Cast

| id | name | who | look (for the art) | voice |
|---|---|---|---|---|
| maz | MAZ | the family's mechanic, about 70, raised the player in the garage | small wiry woman, oil-stained orange overalls, welding goggles pushed up on grey cropped hair, a cigarette she never lights, a huge wrench | dry, sarcastic, secretly proud; short sentences; calls everyone by a nickname |
| warden | THE WARDEN | owner of the league and its boss driver (WRAITH) | tall, black armoured racing leathers with red (#FF3355) trim, a black helmet he never removes with a red visor slit, the stolen Red Lantern sign behind him | calm, formal, few words, talks about drivers like inventory |
| vex | VEX (r06) | first lieutenant: runs the bottom of the ladder, collects "entry fees" | young, wiry, blue (#2EA8FF) mohawk and blue jacket, drives a RAVEN like yours | loud, cocky, laughs at his own jokes |
| razor | RAZOR (r10) | second lieutenant: THE WARDEN's enforcer in the middle ranks | huge, shaved head, purple (#B65CFF) war paint stripe, sleeveless purple jacket, chains; drives a TITAN | slow, menacing, speaks in threats about "parts" |
| duchess | DUCHESS (r16) | third lieutenant: runs the league's money, bets against everyone | elegant older woman, gold (#D9B26F) fur coat over racing suit, sunglasses at night, cigarette holder; drives a BLAZE | posh, amused, treats the race as a stock market |
| banshee | BANSHEE (r19) | last lieutenant: THE WARDEN's champion, number 2 on the ladder | lean, red (#FF3355) racing suit, long white hair, scarred face, a skull painted on the helmet under her arm; drives a VIPER | cold, quiet, one-line warnings; respects only speed |

## 3. Story beats (6 images, each plays once)

A beat plays instead of the track scene before the first race started after its trigger (the intro: before the first career race; the ending: after the title race win, before the champion screen). Ranks are the career ladder rank (`rankOf(save)`, 20 = start, 1 = top).

| id | trigger | image | lines |
|---|---|---|---|
| beat-intro | new career, first race | the Red Lantern Garage at night, chained shut with THE WARDEN's padlock; MAZ in front of the rusty RAVEN | see 3.1 |
| beat-vex | first race at rank <= 15 | a back-alley pit at night, VEX leaning on his RAVEN, blue neon | 3.2 |
| beat-razor | first race at rank <= 10 | a junkyard crusher, RAZOR holding a crushed car door, purple floodlights | 3.3 |
| beat-duchess | first race at rank <= 5 | a smoky private box over a track, DUCHESS at a betting board with the player's odds | 3.4 |
| beat-warden | first race when the boss race is on offer (rank 1) | THE WARDEN's pit: the Red Lantern sign over the black WRAITH, BANSHEE beside it, THE WARDEN facing the camera | 3.5 |
| beat-ending | the title race won | the Red Lantern Garage at dawn, doors open, the sign back up, MAZ in a folding chair, the broken WARDEN helmet on the workbench | 3.6 |

### 3.1 beat-intro
- MAZ: "Forty years this garage stood. Took him one race to make it his."
- MAZ: "Your old man's brakes didn't fail, kid. Somebody helped them."
- MAZ: "This is what's left. A RAVEN with more rust than paint. I put the engine back in. Mostly."
- MAZ: "The Wreckline has twenty slots and you just took the last one. Climb the ladder, and THE WARDEN has to race you for the title."
- MAZ: "Win that, and the garage comes home. Lose, and I'm selling your RAVEN for scrap. Go."

### 3.2 beat-vex (rank 15)
- VEX: "Well well, the Lantern kid. Heard you crawled out of the scrapyard."
- VEX: "Down here you pay me to race. Up there, you pay THE WARDEN. Everybody pays."
- MAZ: "He talks a lot for a man who drives the same car as you and loses."
- VEX: "Enjoy rank fifteen, Lantern. It's as high as strays go."

### 3.3 beat-razor (rank 10)
- RAZOR: "You're climbing. THE WARDEN noticed. That's never good."
- RAZOR: "Last driver who got this high? His car's in there." (he nods at the crusher)
- RAZOR: "So is he."
- MAZ: "Charming. Keep your armour topped up, kid. And don't park near anything with teeth."

### 3.4 beat-duchess (rank 5)
- DUCHESS: "Darling, you're ruining my book. Nobody bet on you. Nobody."
- DUCHESS: "Ten to one against the stray this morning. Three to one now. I hate losing money."
- DUCHESS: "So here's a tip, free of charge: BANSHEE doesn't brake. Ever."
- MAZ: "She's helping you because THE WARDEN owes her. Never trust a helpful crook."
- MAZ: "...But she's right about BANSHEE."

### 3.5 beat-warden (rank 1, boss race offered)
- BANSHEE: "Number one. Fine. Nobody stays there."
- THE WARDEN: "The mechanic's stray. I keep your father's sign over my car. It reminds me what borrowed courage is worth."
- THE WARDEN: "The rule is old: the top of the ladder may challenge me. Win, and the sign is yours. Lose, and I hang your bumper next to it."
- THE WARDEN: "I accept."
- MAZ: "Kid. Whatever happens, I'm proud of you. Now go and make me prouder."

### 3.6 beat-ending (title race won)
- MAZ: "The deed. With his signature on it. I had it framed. Twice, in case you crash into the first one."
- MAZ: "The Red Lantern's open again. First customer this morning was VEX. Wants his RAVEN fixed. I charged him double."
- MAZ: "THE WARDEN? Walked off the track and kept walking. Left the helmet. And the league."
- MAZ: "Which makes you the one at the top of the Wreckline now, kid. Everybody's coming for you."
- MAZ: "Good. Garage needs the business."

**Boss lost** (no image of its own: the beat-warden image with these lines, before the next race): MAZ: "He's still in the pit, kid. So is the sign. Climb back up." / MAZ: "Next time, hit him first."

## 4. Track scenes (10 images, played before every other career race)

One image per track, reused on every visit. A scene shows 3 lines: the track line (rotates over the visits to that track), one stage line (by story stage), and, if a lieutenant is among the race's rivals, one line from that lieutenant (else a second track line).

Story stage: 0 = rank 20-16, 1 = 15-11, 2 = 10-6, 3 = 5-2, 4 = rank 1 or champion.

| track | image | track lines (rotate) |
|---|---|---|
| scrapyard | the scrapyard behind the Red Lantern Garage at night, car stacks, a crane magnet, sparks, MAZ welding a bumper on | MAZ: "Home turf. Every wreck in this yard, I've fixed once." / MAZ: "Mind the stacks. They fall on whoever's nearest. Usually not me." / MAZ: "Your father learned to drive on this yard. Learned to crash here too." |
| dustBowl | a desert fuel stop at noon, heat haze, a dog asleep under a burnt-out bus, bikers by the pumps | MAZ: "Dust Bowl. Hot enough to fry the paint off. Keep the windows shut." / MAZ: "Sand in the engine is fine. Sand in the brakes is a funeral." / MAZ: "Fuel's free out here. So are the bullets." |
| dockside | the docks at night, container stacks, a crane, moonlight on black water, fishermen ignoring a burning car | MAZ: "Dockside. Fall in the water and nobody's fishing you out." / MAZ: "Those dockers bet on wrecks. Don't give them the satisfaction." / MAZ: "Ninety-degree corners round the stacks. Brake like you mean it." |
| frostbite | a snowed-in mountain pass at night, a cabin with one lit window, pines, a snowplough with spikes welded on | MAZ: "Frostbite Pass. Three hairpins and a cliff with no rail. Count to three." / MAZ: "Cold engine, cold tyres, hot temper. Wait for the second lap." / MAZ: "If you spin out up here, the wolves get the car." |
| neonMile | a neon city street at night, billboards, a noodle stand, gamblers watching race odds on a screen | MAZ: "Neon Mile. Every corner is a right angle and every billboard is THE WARDEN." / MAZ: "City folk love a crash. Give them a show, just not yours." / MAZ: "Blocks are tight. Count the turns, kid. There are a lot." |
| redrock | a quarry at late afternoon, red rock walls, a tower crane swinging over the road, dynamite crates | MAZ: "Redrock Quarry. That crane swings over the hairpin. Duck." / MAZ: "Wide bends, then the pinch. Everybody arrives at the pinch together." / MAZ: "They still blast the rock on race days. For atmosphere." |
| junkyardSprint | a cramped junk maze at dusk, tyre walls, a shack with a hand-painted "NO REFUNDS" sign, a goat on a car roof | MAZ: "Junkyard Sprint. Short, ugly and violent. My kind of track." / MAZ: "Two hairpins, one at each end. Ram anything in front of you." / MAZ: "Nobody wins clean here. Win dirty, but win." |
| pineHollow | a dark forest road at night, tall pines, fog, a hunting lodge with skulls over the door | MAZ: "Pine Hollow. There's a blind kink in the forest. You'll know it when the trees try to kill you." / MAZ: "Fog's thick tonight. Follow the taillights. Or don't, they might be lying." / MAZ: "Hunters out here shoot at anything with headlights. Drive fast." |
| rainDistrict | a rain-soaked narrow city street at night, puddles, umbrellas, a chicane of police barriers, a boulevard of lamps | MAZ: "Rain District. Chicane after chicane, then the boulevard. Breathe on the boulevard." / MAZ: "Wet road, dry humour. Try to keep one of them." / MAZ: "The cops here are on THE WARDEN's payroll. So, no help." |
| blastPit | a huge open-pit mine at sunset, two craters, a crane over the cut, miners in hard hats taking bets | MAZ: "Blast Pit. The longest track in the league. Bring a sandwich." / MAZ: "Between the pits there's a hairpin under the crane. Everyone crashes there once." / MAZ: "Miners bet their wages on this one. Don't make them poorer." |

### 4.1 Stage lines (one per scene, rotate inside the stage)

| stage | lines |
|---|---|
| 0 (rank 20-16) | MAZ: "Nobody knows your name yet. Let's fix that." / MAZ: "Rank twenty. Only way is up. Or into a wall." / MAZ: "Win something. Anything. The rent's due." |
| 1 (rank 15-11) | MAZ: "VEX's crew are talking about you. That's progress." / MAZ: "People are starting to bet on you. Small bets. Still." / MAZ: "Middle of the pack is where cars go to die. Don't stay." |
| 2 (rank 10-6) | MAZ: "RAZOR's watching. Keep your doors locked." / MAZ: "Top ten. Your father made it this far. Once." / MAZ: "They've stopped laughing at the RAVEN jokes. Shame, they were good jokes." |
| 3 (rank 5-2) | MAZ: "DUCHESS moved your odds again. You're a favourite now. Terrifying." / MAZ: "BANSHEE doesn't brake. You don't have to beat her, just outlast her." / MAZ: "The sign is close enough to read now, kid." |
| 4 (rank 1 / champion) | MAZ: "Top of the ladder. Everyone you passed wants their spot back." / MAZ: "THE WARDEN's in his pit. Waiting. He's patient. You don't have to be." / MAZ: "Champion or not, the garage still needs a new roof. Win the prize money." |

### 4.2 Lieutenant lines (when that rival is in the race)

| rival | lines (rotate) |
|---|---|
| VEX | VEX: "Lantern! Save me the spot behind you. I like the view of a wreck." / VEX: "Same car as me, kid. Only one of us knows how to drive it." / VEX: "Rematch! I wasn't trying last time." |
| RAZOR | RAZOR: "Your car has good parts. I'd like them." / RAZOR: "I don't race. I collect." / RAZOR: "Lap two. That's when I come for you." |
| DUCHESS | DUCHESS: "I've a little money on you today, darling. Don't embarrass me." / DUCHESS: "Win, and I'll pretend I always believed in you." / DUCHESS: "Lose, and I'll pretend I never met you." |
| BANSHEE | BANSHEE: "Don't brake." / BANSHEE: "I won't look back. Neither should you." / BANSHEE: "Fast. Not fast enough." |
| THE WARDEN (boss race) | THE WARDEN: "Begin." / THE WARDEN: "Your father had the same look." / THE WARDEN: "I've already had the sign polished." |

## 5. How a scene plays (UI rules for the build WP)

- Shown in career after the player picks an offer and presses race, before the race loads (the race is built behind it). Quick race never shows scenes.
- Layout like the old game: the image on top (16:9, letterboxed in the window, pixel art scaled with nearest-neighbour), a dark text panel below with the speaker's name in their colour (MAZ #FF5A1F, THE WARDEN #FF3355, VEX/RAZOR/DUCHESS/BANSHEE their rival colours) and the line in the UI font.
- Each line types out (about 40 characters per second). SPACE or click: finish the line, then next line; after the last line, "SPACE to race" and SPACE starts the race. ESC skips the whole scene. No forced wait, no voice. A soft keyboard tick per few characters is optional (SFX only, no voice).
- A beat's "played" flag is stored in the save so it plays once; a track scene picks its rotating lines from `racesRun` so the same visit always shows the same lines (deterministic, no RNG).
- Missing image: the scene still plays on a dark panel (so the build can ship before all images exist).

## 6. Assets

16 images: 6 beats (`beat-intro`, `beat-vex`, `beat-razor`, `beat-duchess`, `beat-warden`, `beat-ending`) + 10 tracks (track ids). Generated by the user in Gemini from `specs/story-art-prompts.md`, saved as PNG, 1920x1080 or the closest 16:9 Gemini gives. The import step converts them to WebP (about 150-250 kB each) into `public/story/<id>.webp`.
