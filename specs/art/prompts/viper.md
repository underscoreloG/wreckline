# VIPER - sheet prompt (`viper`)

| | |
|---|---|
| Concept sheet position | top row, 4th from the left |
| Size (content.md section 1) | 4.5 m long x 2.0 m wide x 0.55 m body height (without cabin), wheel radius 0.36 m |
| Colours | sampled by script from the concept sheet (median of the car's pixels per colour class), checked by eye on a swatch strip |
| Race-camera read | purple wedge, twin silver stripes, tall black wing across the tail (BLAZE's wing is low and red) |

## Prompt (paste as-is, with the concept sheet attached)

```text
Use the attached concept sheet. Draw ONLY the car labelled VIPER (top row, fourth from the left). Ignore the other cars and the RAVEN strip at the bottom.

Make one game-asset turnaround sheet of this one car, landscape 3:2:
- Top row, left to right: FRONT view, SIDE (facing right) view with the nose pointing to the right edge of the image, REAR view.
- Bottom row, left to right: TOP (nose up) view seen straight from above with the nose pointing to the top edge of the image, then one 3/4 hero view from the front and slightly above, like the concept.
- FRONT, SIDE, REAR and TOP are orthographic (no perspective), at the same scale in every view, standing on one common ground line, with empty space between the views and the whole car visible in each view.
- Plain flat mid-grey background, even soft lighting, no text, no labels, no watermark, no ground shadow, no reflections, no motion blur.

Style: simple low-poly game model, flat planes and chamfered edges, a closed solid body with no see-through gaps. Keep the concept's grunge in the texture, not in the geometry: rust, chipped paint, dirt and scratches are painted on, the surfaces stay flat. Wheels are simple chunky cylinders. Nothing sticks out sideways past the wheels. No real car brand, badge or logo.

Car: VIPER, a top-tier 1980s wedge-shaped supercar. Very low, angular body with wide rear fenders, a short cabin set slightly behind the middle, side air intakes, a tall black rear wing on two struts standing well above the rear deck and as wide as the body, a small steel guard under the front lip, chunky tyres on dark rims. Purple paint with two silver-grey racing stripes over the hood and the rear deck, worn and scratched.

Main colors (sampled from the concept sheet): body purple #602F71, racing stripes silver-grey #8B8A9A, rear wing, trim and intakes black #0F0E0E.

Roof: the roof is a plain painted panel in purple #602F71 with no decals: the silver stripes stop at the windscreen and start again behind the roof, only light wear. The game adds its own roof plate.

Proportions: 4.5 m long x 2.0 m wide x 0.55 m body height (body without the cabin). Overall height about 1.3 m with cabin and wheels, plus the wing, wheel diameter 0.72 m. In the TOP view the car is 2.25 times as long as it is wide.

Seen from above it must read at a glance as: a purple wedge with twin silver stripes on the hood and the rear deck, a purple roof between them and the big black wing across the tail.
```
