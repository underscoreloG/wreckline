# What WP14 checks on import

Rule: every claim from a generator is measured on import, never trusted. In the Can It Code? videos the generators misreported: a model asked for 3k faces came back with 5k, and 4 models faced backwards. So WP14's `scripts/assets/importCars.mjs` measures each GLB and exits 1 if any car breaks a budget. Use this list to reject a bad output before you drop it in `art-incoming/cars/<id>/`.

| Check | What WP14 does | Budget or target | What you can check first |
|---|---|---|---|
| Facing | Takes the longest horizontal axis as the length. Picks the nose as the end that matches the sheet's 3/4 hero view, else the end with the bull bar or front lights, rotates it to face +x, and writes down the decision per car. | Nose at +x | The front is obvious: lights, grille, bull bar or ram at one end only. The sheet's hero view shows the front. |
| Scale | Scales the model so its bounding box is `length x width` from content.md section 1; height follows. Anything that sticks out (spikes, wing, ram, mirrors, tyres) counts in the box. | See the size table below | In the TOP view, length to width matches the ratio in the prompt. Long spikes or a wide wing make the body smaller after the fit. |
| Ground | Puts the wheels on y = 0. | Wheels touch y = 0 | No ground plane, base or stand under the model. |
| Faces | Decimates to the budget and prints input and output face counts. | <= 4000 triangles per car | Tripo's reported count is a hint only (it may count quads). Far over 4000 means heavy decimation and lost detail. |
| Textures | Resizes every texture. | <= 1024 px (WebP if the optimizer supports it in glTF, else PNG) | One textured mesh with one material is best; many materials cost draw calls. |
| File size | Sums `public/models/cars`. | <= 4 MB for all 8 cars (about 0.5 MB each) | Nothing: the resize and decimation handle it. |
| Roof plate | Measures the largest flat area visible from above (top-down height map) and writes its box `{ x, z, length, width, y }` to `public/models/cars/manifest.json`. The game draws the roof plate there in the driver's colour with one decal. | One flat roof area per car. OUTLAW: on top of the roll cage. ICEBERG: on top of the roof rack. TITAN: the cab roof (the turret stands in the bed). | The roof is flat and plain, not domed or bumpy, with no decals (they would be covered anyway). |
| Draw calls | Race with 4 imported cars. | `drawCalls < 150`, no console errors | Few separate objects and materials per model. |
| Wheels | Wheels stay part of the model and do not spin (accepted at race height). | - | Wheels are present and round, not melted into the body. |
| Look | After the merge the brain screenshots the lineup (race camera height) and close-ups (garage distance), a fresh critic agent judges them against the concept sheet, then you judge. | Matches the concept; told apart by silhouette from above | The sheet already matches the concept before you spend a Tripo run on it. |

## Target sizes (content.md section 1)

Body height is without the cabin; the import fits length and width only.

| id | length (m) | width (m) | body height (m) | length / width |
|---|---|---|---|---|
| `raven` | 4.2 | 2.0 | 0.7 | 2.1 |
| `outlaw` | 3.8 | 2.0 | 0.6 | 1.9 |
| `iceberg` | 4.9 | 2.1 | 0.8 | 2.33 |
| `scorch` | 4.8 | 2.2 | 0.8 | 2.18 |
| `blaze` | 4.4 | 2.0 | 0.55 | 2.2 |
| `titan` | 5.2 | 2.4 | 1.0 | 2.17 |
| `viper` | 4.5 | 2.0 | 0.55 | 2.25 |
| `wraith` | 5.2 | 2.4 | 0.9 | 2.17 |

## Readability (design.md "Car art")

The race camera sits 46-62 m up: a car is about 150 px long at 1080p at rest. Silhouette and roof plate read in races; grunge, small decals and skulls read only in the garage, shop and results screens. RAVEN and WRAITH have dark bodies, so the game gives their roof plate a light edge trim; nothing to do on the model side.
