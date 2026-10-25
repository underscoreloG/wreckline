# Changelog

## 0.6.0 - Balance pass (2026-10-25)

- Shorter career: a strong player can become champion in roughly 20-35 races instead of 90+.
- Rivals carry lighter upgrades, and THE WARDEN no longer gets a speed bonus over a stock Wraith: the boss is beatable with a well-upgraded Viper.
- Race prizes up 50% (sabotage prices follow); Titan now 9000, Viper 12000.
- Mines hit harder (50 at the centre, 25 at the edge); AI drivers fire a little more and drop fewer mines.
- Medium races draw rivals from a wider rank window, so they no longer match the easy race at career start.
- AI drivers stuck nose-to-nose with a wreck now back off and steer round it.

## 0.5.1 - AI fix (2026-10-25)

- AI drivers no longer push wrecked cars along the track: they slow down behind a wreck and pass it with room to spare.

## 0.5.0 - Ten tracks (2026-10-25)

- Four more tracks: Junkyard Sprint (short and violent, a hairpin at each end), Pine Hollow (fast forest sweepers with a blind kink), Rain District (chicanes and a long boulevard), Blast Pit (the longest, a double loop around two pits).
- Career unlocks all 10 by rank 6; quick race picker lists all 10.

## 0.4.0 - Rocket fuel, spikes, sabotage, 6 tracks, real sounds (2026-10-25)

- Rocket fuel: the boost is now called rocket fuel and can be upgraded in the shop (5 levels: up to +15% boost speed, +25% boost acceleration).
- Bumper spikes: new upgrade line (3 levels). Ramming with your front deals up to 2.5x damage and you take less.
- Sabotage: before a career race, pay a mechanic (30% of the winner's prize) to damage the leading rival in that race by 25-49%.
- Rivals now carry rocket fuel and spikes upgrades by skill.
- Three new tracks with new looks: Frostbite Pass (snow), Neon Mile (rainy city), Redrock Quarry. Career unlocks tracks as you climb the ladder; quick race has a track picker.
- Recorded sound effects (Pixabay, free licence) replace most synth sounds; the engine stays synthesised.
- Champion screen shows wrecks and cash earned. Old saves load automatically.

## 0.3.1 - Instant results (2026-10-25)

- Results appear 1.5 s after you finish or wreck. The rest of the race is fast-forwarded in the background, so positions and times are exactly what they would have been if you had waited.

## 0.3.0 - Career (2026-10-25)

- Career mode: ladder of 19 rivals plus a boss, three race offers per round (easy, medium, hard; boss at rank 1), payouts, standings, champion screen. Progress saves in the browser.
- Garage with a turning 3D preview of your car, shop with upgrades, supplies and 3 cars to buy.
- Two new tracks in the career rotation: Dust Bowl (desert, golden hour) and Dockside (night docks by the water).
- Damage carries over between career races. Partial repairs (+25%, max affordable, full), and a free tow to 30% if you are wrecked and broke, so a career never gets stuck.
- No restarts in a career race (pause shows only resume, settings, quit).
- Known: careers are much longer than intended (balancing comes in a later release).

## 0.2.1 - Tuning pass 1 (2026-10-25)

- Faster: every car +15% top speed and +20% acceleration (laps ~31 s -> ~27.7 s on Scrapyard).
- Closer camera (46-62 m) and white speed streaks while turbo is on.
- More bonuses: Scrapyard pickups 6 -> 12, respawn 12 s -> 8 s.
- Plain full steering now shows drift smoke from about 64% of top speed (was 70%).

## 0.2.0 - M1 vertical slice (2026-10-25)

- Playable quick race on Scrapyard: 3 laps, the player against 3 AI drivers.
- Driving with drift, handbrake and turbo; front machine gun with overheat, rear mines.
- Damage, smoke and fire, wrecks, pickups (cash, repair, mines, turbo).
- Low-poly 3D renderer with bloom, particles and a follow camera; procedural audio.
- Title (live backdrop), controls, settings (saved locally), pre-race, pause, results; HUD with minimap and kill feed.
- Keyboard and gamepad.
- GitHub Pages deploy workflow.
