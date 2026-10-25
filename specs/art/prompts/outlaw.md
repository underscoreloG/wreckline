# OUTLAW - sheet prompt (`outlaw`)

| | |
|---|---|
| Concept sheet position | bottom car row, 1st from the left |
| Size (content.md section 1) | 3.8 m long x 2.0 m wide x 0.6 m body height (without cabin), wheel radius 0.48 m |
| Colours | sampled by script from the concept sheet (median of the car's pixels per colour class), checked by eye on a swatch strip |
| Race-camera read | open roll cage over the cockpit, four big wheels outside a narrow body, light bar at the front |

## Prompt (paste as-is, with the concept sheet attached)

```text
Use the attached concept sheet. Draw ONLY the car labelled OUTLAW (second row, first from the left). Ignore the other cars and the RAVEN strip at the bottom.

Make one game-asset turnaround sheet of this one car, landscape 3:2:
- Top row, left to right: FRONT view, SIDE (facing right) view with the nose pointing to the right edge of the image, REAR view.
- Bottom row, left to right: TOP (nose up) view seen straight from above with the nose pointing to the top edge of the image, then one 3/4 hero view from the front and slightly above, like the concept.
- FRONT, SIDE, REAR and TOP are orthographic (no perspective), at the same scale in every view, standing on one common ground line, with empty space between the views and the whole car visible in each view.
- Plain flat mid-grey background, even soft lighting, no text, no labels, no watermark, no ground shadow, no reflections, no motion blur.

Style: simple low-poly game model, flat planes and chamfered edges, a closed solid body with no see-through gaps except the open roll cage. Keep the concept's grunge in the texture, not in the geometry: rust, chipped paint, dirt and scratches are painted on, the surfaces stay flat. Wheels are simple chunky cylinders. Nothing sticks out sideways past the wheels. No real car brand, badge or logo.

Car: OUTLAW, a light off-road dune buggy. Short open body, an exposed tubular roll cage over the open cockpit with a bar of 4 round spotlights on the front top rail, long-travel suspension, oversized knobbly off-road tyres that stand out past the narrow body, a small tubular front bumper. Red body panels with an abstract hand-painted graffiti scrawl on the side (no readable letters), white racing stripes on the short hood.

Main colors (sampled from the concept sheet): body panels red #8F1B17, hood stripes off-white #D6CCC2, roll cage, frame and trim dark gunmetal #161514, rust #563324.

Roof: OUTLAW has no solid roof: keep the open roll cage exactly like the concept. Its top rails are plain painted gunmetal #161514 tubes with no decals, no stickers, no flags. The game lays its own roof plate across the top of the cage.

Proportions: 3.8 m long x 2.0 m wide x 0.6 m body height (body without the cabin). Overall height about 1.8 m to the top of the roll cage, wheel diameter 0.96 m. In the TOP view the car is 1.9 times as long as it is wide, wheels included.

Seen from above it must read at a glance as: a rectangular open roll cage over the cockpit, four big wheels clearly outside the narrow body, the light bar at the front.
```
