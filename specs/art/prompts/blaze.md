# BLAZE - sheet prompt (`blaze`)

| | |
|---|---|
| Concept sheet position | top row, 2nd from the left |
| Size (content.md section 1) | 4.4 m long x 2.0 m wide x 0.55 m body height (without cabin), wheel radius 0.36 m |
| Colours | sampled by script from the concept sheet (median of the car's pixels per colour class), checked by eye on a swatch strip |
| Race-camera read | flat red wedge, twin white stripes on hood and rear deck, low rear wing |

## Prompt (paste as-is, with the concept sheet attached)

```text
Use the attached concept sheet. Draw ONLY the car labelled BLAZE (top row, second from the left). Ignore the other cars and the RAVEN strip at the bottom.

Make one game-asset turnaround sheet of this one car, landscape 3:2:
- Top row, left to right: FRONT view, SIDE (facing right) view with the nose pointing to the right edge of the image, REAR view.
- Bottom row, left to right: TOP (nose up) view seen straight from above with the nose pointing to the top edge of the image, then one 3/4 hero view from the front and slightly above, like the concept.
- FRONT, SIDE, REAR and TOP are orthographic (no perspective), at the same scale in every view, standing on one common ground line, with empty space between the views and the whole car visible in each view.
- Plain flat mid-grey background, even soft lighting, no text, no labels, no watermark, no ground shadow, no reflections, no motion blur.

Style: simple low-poly game model, flat planes and chamfered edges, a closed solid body with no see-through gaps. Keep the concept's grunge in the texture, not in the geometry: rust, chipped paint, dirt and scratches are painted on, the surfaces stay flat. Wheels are simple chunky cylinders. Nothing sticks out sideways past the wheels. No real car brand, badge or logo.

Car: BLAZE, a sharp 1980s wedge-shaped supercar. Very low, flat, angular body, a short cabin set slightly behind the middle, side air intakes behind the doors, a low rear wing close to the rear deck, a light steel guard under the front lip, chunky tyres on dark rims. Red paint with two wide white racing stripes running over the hood and over the rear deck.

Main colors (sampled from the concept sheet): body red #AE1F1D, racing stripes off-white #E5DDD5, trim, intakes and grille black #12100F.

Roof: the roof is a plain painted panel in red #AE1F1D with no decals: the white stripes stop at the windscreen and start again behind the roof, only light wear. The game adds its own roof plate.

Proportions: 4.4 m long x 2.0 m wide x 0.55 m body height (body without the cabin). Overall height about 1.3 m with cabin and wheels, wheel diameter 0.72 m. In the TOP view the car is 2.2 times as long as it is wide.

Seen from above it must read at a glance as: a flat red wedge with twin white stripes on the hood and the rear deck, a red roof between them and a low wing across the tail.
```
