# RAVEN - sheet prompt (`raven`)

| | |
|---|---|
| Concept sheet position | top row, 1st from the left (also the turnaround strip at the bottom) |
| Size (content.md section 1) | 4.2 m long x 2.0 m wide x 0.7 m body height (without cabin), wheel radius 0.38 m |
| Colours | sampled by script from the concept sheet (median of the car's pixels per colour class), checked by eye on a swatch strip |
| Race-camera read | dark muscle coupe: hood skull, bull bar at the nose, spoiler at the tail |

## Prompt (paste as-is, with the concept sheet attached)

```text
Use the attached concept sheet. Draw ONLY the car labelled RAVEN (top row, first from the left). Ignore the other cars. The small RAVEN strip at the bottom of the sheet shows its side view facing left and its top view nose down: ignore those orientations and follow this prompt.

Make one game-asset turnaround sheet of this one car, landscape 3:2:
- Top row, left to right: FRONT view, SIDE (facing right) view with the nose pointing to the right edge of the image, REAR view.
- Bottom row, left to right: TOP (nose up) view seen straight from above with the nose pointing to the top edge of the image, then one 3/4 hero view from the front and slightly above, like the concept.
- FRONT, SIDE, REAR and TOP are orthographic (no perspective), at the same scale in every view, standing on one common ground line, with empty space between the views and the whole car visible in each view.
- Plain flat mid-grey background, even soft lighting, no text, no labels, no watermark, no ground shadow, no reflections, no motion blur.

Style: simple low-poly game model, flat planes and chamfered edges, a closed solid body with no see-through gaps. Keep the concept's grunge in the texture, not in the geometry: rust, chipped paint, dirt and scratches are painted on, the surfaces stay flat. Wheels are simple chunky cylinders. Nothing sticks out sideways past the wheels. No real car brand, badge or logo.

Car: RAVEN, a battered 1970s-style muscle coupe. Long flat hood, short fastback cabin set slightly behind the middle of the car, small rear spoiler, a heavy tubular steel bull bar across the front bumper, round headlights, chunky tyres on dark steel rims. A big pixel-art skull is painted on the hood.

Main colors (sampled from the concept sheet): body near-black #141312, hood skull off-white #D3C8C0, rust streaks and chipped paint #64412F, bull bar and bumpers bare steel #6A6664.

Roof: the roof is a plain painted panel in near-black #141312 with no decals, no stripes, no skull, only light wear. The game adds its own roof plate.

Proportions: 4.2 m long x 2.0 m wide x 0.7 m body height (body without the cabin). Overall height about 1.5 m with cabin and wheels, wheel diameter 0.76 m. In the TOP view the car is 2.1 times as long as it is wide.

Seen from above it must read at a glance as: a dark muscle coupe with the skull on the long hood, the bull bar sticking out at the nose and the spoiler across the tail.
```
