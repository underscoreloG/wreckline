# Car art: generate the 8 sheets and models (WP13U checklist)

You generate, in your own accounts: one turnaround sheet per car in ChatGPT (image generation), then one 3D model per car in Tripo (image to model). WP14 imports the files afterwards and measures everything (see `checks.md`).

Before you start:
- Concept sheet to attach: `specs/art/cars-concept-v1.webp`. If ChatGPT refuses the WebP file, export it as PNG first (Preview: File > Export > PNG, or `ffmpeg -i specs/art/cars-concept-v1.webp cars-concept-v1.png`).
- Do **RAVEN first**, then send its `sheet.png` to the brain for a spot check against the concept. Run the other 7 only after that "ok".
- One car per ChatGPT chat. A fresh chat per car stops features leaking from one car to the next.

| id | prompt file | name on the sheet | size (length x width x body height) |
|---|---|---|---|
| `raven` | `raven.md` | RAVEN | 4.2 x 2.0 x 0.7 m |
| `outlaw` | `outlaw.md` | OUTLAW | 3.8 x 2.0 x 0.6 m |
| `iceberg` | `iceberg.md` | ICEBERG | 4.9 x 2.1 x 0.8 m |
| `scorch` | `scorch.md` | SCORCH | 4.8 x 2.2 x 0.8 m |
| `blaze` | `blaze.md` | BLAZE | 4.4 x 2.0 x 0.55 m |
| `titan` | `titan.md` | TITAN | 5.2 x 2.4 x 1.0 m |
| `viper` | `viper.md` | VIPER | 4.5 x 2.0 x 0.55 m |
| `wraith` | `wraith.md` | WRAITH | 5.2 x 2.4 x 0.9 m |

## Per car: 5 steps

1. **Sheet (ChatGPT).** New chat, attach the concept sheet, paste the whole `text` block from `<id>.md` as-is, send. Download the result as PNG.
2. **Check the sheet** against "Reject and regenerate if" below. A small miss (roof decal, one stray label): ask in the same chat "Same image, only change: <the fix>". A big miss (wrong car, wrong layout, perspective views): regenerate in a new chat.
3. **Model (Tripo, image to model).** Crop the FRONT, SIDE and REAR views out of the sheet into 3 separate PNGs (Preview: drag a rectangle around one view with some grey margin, Tools > Crop, File > Export as PNG; repeat per view). In Tripo, start a multi-view image-to-model job: FRONT in the front slot, REAR in the back slot, SIDE in the side slot. The SIDE view shows the car's right flank (nose pointing right): if the model comes back with the nose and tail swapped, put SIDE in the other side slot and regenerate.
4. **Export GLB.** Check the model in Tripo's viewer against "Reject and regenerate if", then export as GLB.
5. **Drop the files** in the main project checkout (`/Users/kevin/Downloads/Claude/wreckline`, not a worktree), exactly here (the folder is gitignored, WP14 reads from it):
   - `art-incoming/cars/<id>/sheet.png`
   - `art-incoming/cars/<id>/<id>.glb`

   Example for RAVEN: `art-incoming/cars/raven/sheet.png` and `art-incoming/cars/raven/raven.glb`. Create the folders once with:
   `mkdir -p art-incoming/cars/{raven,outlaw,iceberg,scorch,blaze,titan,viper,wraith}`

## Tripo settings

| Setting | Value |
|---|---|
| Input | multi-view (front, side, back views cropped from the sheet) |
| Target face count (face limit) | 4000 |
| Texture | textured (on). HD texture not needed: WP14 resizes to 1024 px |
| Export format | GLB |

Tripo's option names change between versions (not checked against the current UI): pick the closest match. If your plan has no multi-view input, use single-image input with the 3/4 hero view cropped from the sheet and tell the brain which cars went that way. Tripo may count quads or simply miss the target ("asked 3k faces, got 5k"): WP14 decimates to 4000 triangles and measures, so a model a bit over the target is fine; one far over it (more than about 2x) loses detail in the decimation, so regenerate.

## Reject and regenerate if

Sheet (step 2):
- Any text, label, number, watermark or real brand logo in the image.
- A view is missing, cropped, or in perspective (only the hero view may have perspective).
- SIDE has the nose pointing left, or TOP has the nose pointing anywhere but up.
- The views are not at the same scale (the car's length differs between SIDE and TOP).
- The background is not plain flat grey: gradient, floor, ground shadow, reflections.
- The roof has decals, stripes, a skull or flames (TITAN: turret on the cab roof).
- It is the wrong car, or it borrows another car's feature (VIPER's tall wing on BLAZE, RAVEN's skull on SCORCH).
- The body colours are clearly off from the hex values in the prompt, or the TOP view proportions are clearly off the length-to-width ratio in the prompt.
- Strong baked lighting: hard shadows or bright highlights painted on the car (Tripo bakes them into the texture).

Model (step 4):
- The nose is hard to tell from the tail (no clear lights, grille or bull bar at the front).
- Holes, floating bits, missing or melted wheels, a ground plane or base under the car.
- The roof is domed, bumpy or caved in instead of flat (the game lays a flat roof plate on it).
- Grunge modelled as geometry (lumpy surfaces) instead of painted in the texture.
- Many separate objects or materials instead of one textured mesh.
- Face count far over the 4000 target (see Tripo settings).

## Done

WP13U is done when all 8 `art-incoming/cars/<id>/` folders hold `sheet.png` and `<id>.glb`. Check from the project root:

```sh
for id in raven outlaw iceberg scorch blaze titan viper wraith; do ls art-incoming/cars/$id/sheet.png art-incoming/cars/$id/$id.glb; done
```
