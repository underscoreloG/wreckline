# Story frames: Gemini image prompts (v1, 2026-10-27)

16 images for the career story (`specs/story.md`): 6 story beats + 10 track scenes.

## How to use

1. **Start with prompt 0 (the character sheet).** Keep regenerating until the six faces and outfits look right, then save it as `cast-sheet.png`.
2. **Generate one test scene before the rest:** `beat-intro`. Send it to me before doing the other 14; if the style is off, we fix the style block once instead of 16 times.
3. **Attach the cast sheet** as a reference image to every prompt that shows a character. Start the message with: "Use the attached character sheet for the characters' faces and outfits."
4. **Every prompt already ends with the style block**, so paste each prompt whole.
5. **Save each result** as `<id>.png` (the id is in each heading) in `~/Downloads/Claude/wreckline/story-art/`. I convert them for the game.
6. **If Gemini adds text, logos, captions or a frame**, regenerate. The game draws all text itself.

**Style block** (already included at the end of every prompt):

> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic, characters in the left or right third so the scene reads at a glance. No text, no letters, no logos, no UI, no borders, no watermark.

---

## 0. cast-sheet (character reference sheet, generate first)

> A character reference sheet with six characters standing side by side in a line, full body, neutral pose, plain dark grey background, each clearly separated:
> 1. MAZ: a small wiry woman about 70, oil-stained orange overalls, welding goggles pushed up on cropped grey hair, an unlit cigarette in her mouth, carrying a huge wrench over her shoulder, a dry smirk.
> 2. THE WARDEN: a tall imposing figure in black armoured racing leathers with thin bright red trim, a black full-face racing helmet with a narrow glowing red visor slit, black gloves, arms folded.
> 3. VEX: a skinny young man with a tall electric-blue mohawk, a blue bomber jacket covered in patches, a cocky grin, spinning a car key on one finger.
> 4. RAZOR: a huge bald man with a purple war-paint stripe across his eyes, a sleeveless purple jacket, heavy chains, scarred arms, holding a crowbar.
> 5. DUCHESS: an elegant older woman in a gold fur coat over a racing suit, big sunglasses, pearls, a long cigarette holder, amused expression.
> 6. BANSHEE: a lean woman in a red racing suit, long white hair, a scar across one cheek, holding a red helmet with a white skull painted on it under her arm, cold stare.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition. No text, no letters, no logos, no UI, no borders, no watermark.

---

## Story beats

### beat-intro
> Night. A small run-down family car garage with a big rusty roll-up door chained shut with a heavy padlock; an empty sign bracket above the door where a sign used to hang. In front of it, MAZ (old woman mechanic, orange overalls, goggles on grey hair, unlit cigarette, huge wrench) leans on a battered rusty muscle car, dark red primer paint with rust patches, one headlight working. Puddles, a single street lamp, junk piles in the background, a red glow on the horizon from a race track. Melancholy but defiant mood.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic, characters in the left or right third so the scene reads at a glance. No text, no letters, no logos, no UI, no borders, no watermark.

### beat-vex
> Night, a back-alley pit area lit by flickering blue neon. VEX (skinny young man, electric-blue mohawk, blue patched bomber jacket, cocky grin) leans against his black muscle car with blue stripes, spinning a key on his finger. Behind him a few young hoodlums with tyre irons, graffiti on brick walls, oil drums burning. He looks straight at the viewer, mocking.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic, characters in the left or right third so the scene reads at a glance. No text, no letters, no logos, no UI, no borders, no watermark.

### beat-razor
> Night, a junkyard with a giant hydraulic car crusher in the middle, purple floodlights from above. RAZOR (huge bald man, purple war-paint stripe over his eyes, sleeveless purple jacket, chains) stands in front of the crusher holding a crushed car door in one hand like a trophy. A flattened car cube sits in the crusher. Sparks, steam, menacing mood with a dark joke: a tiny "for sale" price tag hangs on the crushed cube.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic, characters in the left or right third so the scene reads at a glance. No text, no letters, no logos, no UI, no borders, no watermark.

### beat-duchess
> Inside a smoky private viewing box high above a night race track, big window behind showing distant track lights. DUCHESS (elegant older woman, gold fur coat, big sunglasses, pearls, long cigarette holder) sits in a velvet armchair beside a chalkboard covered in tally marks and numbers (no readable words), a bottle of champagne in an ice bucket, a nervous bookkeeper with a ledger behind her. Warm gold light, decadent and amused mood.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic, characters in the left or right third so the scene reads at a glance. No text, no letters, no logos, no UI, no borders, no watermark.

### beat-warden
> A dark grand pit garage like a throne room. In the centre, a long black supercar with red trim on a raised platform, lit from above. Above it hangs a large old rusty garage sign with a red lantern painted on it (the stolen family sign, no letters). THE WARDEN (tall, black armoured racing leathers with red trim, black helmet with glowing red visor slit) stands in front of the car facing the viewer, arms folded. To one side BANSHEE (lean woman, red racing suit, long white hair, scarred cheek, skull helmet under her arm) leans on the car. Red and black colour scheme, intimidating, final-boss mood.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic, characters in the left or right third so the scene reads at a glance. No text, no letters, no logos, no UI, no borders, no watermark.

### beat-ending
> Dawn, golden morning light. The same small family car garage as before, now with the roll-up door open, the rusty sign with a painted red lantern hanging proudly back above the door (no letters), the broken chain and padlock on the ground. MAZ (old woman mechanic, orange overalls, goggles, unlit cigarette) sits in a folding chair in front with her feet up on a crate, a framed document on the wall inside. On the workbench inside: a cracked black racing helmet with a red visor. The battered dark red muscle car parked out front, covered in dents and victory scratches. Warm, triumphant, funny mood.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic, characters in the left or right third so the scene reads at a glance. No text, no letters, no logos, no UI, no borders, no watermark.

---

## Track scenes

### scrapyard
> Night, a scrapyard behind a small family garage: towering stacks of crushed cars, a crane with a big electromagnet, orange work lights, rain puddles. MAZ (old woman mechanic, orange overalls, goggles, unlit cigarette) welds a bumper onto a rusty dark red muscle car, sparks flying. A race track fence with red and white kerbs in the background.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic, characters in the left or right third so the scene reads at a glance. No text, no letters, no logos, no UI, no borders, no watermark.

### dustBowl
> Blazing noon in the desert, heat haze. A lonely run-down fuel stop with two old pumps, a burnt-out school bus, a dog asleep in its shade. Rough-looking bikers lean on their bikes by the pumps watching race cars kick up dust on a dirt track in the background. Sun-bleached colours, ochre and pale blue sky.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic, characters in the left or right third so the scene reads at a glance. No text, no letters, no logos, no UI, no borders, no watermark.

### dockside
> Night at the docks. Stacks of rusty shipping containers, a big harbour crane, cold blue moonlight on black water, orange sodium lamps. Two bored dock workers sit on a crate fishing off the quay, ignoring a car burning in the background on a track between the containers.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic, characters in the left or right third so the scene reads at a glance. No text, no letters, no logos, no UI, no borders, no watermark.

### frostbite
> Night on a snowy mountain pass. Tall dark pines heavy with snow, a log cabin with one warm lit window, a big yellow snowplough with spikes welded onto its blade parked by the road, switchback road with snowbanks winding down the slope, cold blue moonlight, falling snow.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic, characters in the left or right third so the scene reads at a glance. No text, no letters, no logos, no UI, no borders, no watermark.

### neonMile
> Night in a dense neon city. Tall buildings with glowing billboards in pink, cyan and yellow (abstract shapes only, no letters), a steaming noodle stand, a crowd of gamblers staring up at a big screen showing race cars, wet street reflecting the neon, a right-angle corner with a crash barrier.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic, characters in the left or right third so the scene reads at a glance. No text, no letters, no logos, no UI, no borders, no watermark.

### redrock
> Late afternoon in a red rock quarry, hot orange light, long shadows. Terraced red rock walls, a tall yellow tower crane swinging its jib over a dirt road, stacked dynamite crates with warning stripes, quarry workers in hard hats watching from a rock ledge.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic, characters in the left or right third so the scene reads at a glance. No text, no letters, no logos, no UI, no borders, no watermark.

### junkyardSprint
> Dusk in a cramped junk maze: walls of stacked tyres and car wrecks, a tin shack with a hand-painted sign board (no readable letters), a goat standing on the roof of a wrecked car, fairy lights strung between poles, purple and orange sky.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic, characters in the left or right third so the scene reads at a glance. No text, no letters, no logos, no UI, no borders, no watermark.

### pineHollow
> Night in a dark pine forest, thick fog, a narrow road disappearing between tall trees, a hunting lodge with animal skulls over the door and a lantern, two pairs of headlights glowing in the fog, eerie green-blue light.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic, characters in the left or right third so the scene reads at a glance. No text, no letters, no logos, no UI, no borders, no watermark.

### rainDistrict
> Heavy rain at night in a narrow old city street. Puddles, people with black umbrellas, a chicane made of striped police barriers, a long boulevard of street lamps in the distance, a police car parked with its lights off and a bribe envelope on the dashboard, reflections everywhere.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic, characters in the left or right third so the scene reads at a glance. No text, no letters, no logos, no UI, no borders, no watermark.

### blastPit
> Sunset over a huge open-pit mine with two giant terraced craters side by side, a road between them, a yellow crane over the cut, dust clouds, miners in hard hats with lamps sitting on a ledge holding fistfuls of cash and shouting bets, a distant explosion plume.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic, characters in the left or right third so the scene reads at a glance. No text, no letters, no logos, no UI, no borders, no watermark.

---

## Main menu

### title-menu (key art behind the title menu; attach the cast sheet)
> Key art for a racing game title screen. Night, a wet race track straight with red and white kerbs, seen low and wide. On the right half: the battered dark red rusty muscle car with one headlight on, sliding toward the viewer with sparks under it, and behind it, a black supercar with red trim chasing it. Looming huge in the sky above the right side, like a storm cloud, the faint silhouette of THE WARDEN's black helmet with its glowing red visor slit. In the far background a city skyline in flames and searchlights, and the rusty garage sign with a painted red lantern hanging from a crane. The whole left 40% of the image is dark, calm and empty (night sky, dark asphalt, soft smoke) with no characters or bright details, because the game menu is drawn there. Moody, dramatic, red and black with orange fire light.
> Style: 1990s DOS PC game cutscene, painted pixel art like Death Rally (1996) and Full Throttle, chunky visible pixels at roughly 480x270 native resolution scaled up, limited palette of about 48 colours, strong rim light, deep shadows, slightly grimy and humorous post-apocalyptic racing world. Wide 16:9 landscape composition, cinematic. No text, no letters, no logos, no UI, no borders, no watermark.
