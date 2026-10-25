# ICEBERG - sheet prompt (`iceberg`)

| | |
|---|---|
| Concept sheet position | bottom car row, 3rd from the left |
| Size (content.md section 1) | 4.9 m long x 2.1 m wide x 0.8 m body height (without cabin), wheel radius 0.40 m |
| Colours | sampled by script from the concept sheet (median of the car's pixels per colour class), checked by eye on a swatch strip |
| Race-camera read | long blue wagon roof with the roof rack grid on top |

## Prompt (paste as-is, with the concept sheet attached)

```text
Use the attached concept sheet. Draw ONLY the car labelled ICEBERG (second row, third from the left). Ignore the other cars and the RAVEN strip at the bottom.

Make one game-asset turnaround sheet of this one car, landscape 3:2:
- Top row, left to right: FRONT view, SIDE (facing right) view with the nose pointing to the right edge of the image, REAR view.
- Bottom row, left to right: TOP (nose up) view seen straight from above with the nose pointing to the top edge of the image, then one 3/4 hero view from the front and slightly above, like the concept.
- FRONT, SIDE, REAR and TOP are orthographic (no perspective), at the same scale in every view, standing on one common ground line, with empty space between the views and the whole car visible in each view.
- Plain flat mid-grey background, even soft lighting, no text, no labels, no watermark, no ground shadow, no reflections, no motion blur.

Style: simple low-poly game model, flat planes and chamfered edges, a closed solid body with no see-through gaps. Keep the concept's grunge in the texture, not in the geometry: rust, chipped paint, dirt and scratches are painted on, the surfaces stay flat. Wheels are simple chunky cylinders. Nothing sticks out sideways past the wheels. No real car brand, badge or logo.

Car: ICEBERG, a boxy 1980s-style station wagon. Long flat roof running all the way back to the tailgate, an empty rusty steel roof rack with rails on top, a steel bull bar on the front, square headlights, chunky tyres on dark steel rims. Blue paint with scratches and small faded scribbles on the doors.

Main colors (sampled from the concept sheet): body blue #305490, roof rack rusty steel #574437, bumpers, bull bar and trim steel #7D7978.

Roof: keep the empty roof rack like the concept, with no luggage. The roof panel under the rack is a plain painted panel in blue #305490 with no decals, no stripes, only light wear. The game adds its own roof plate on top of the rack.

Proportions: 4.9 m long x 2.1 m wide x 0.8 m body height (body without the cabin). Overall height about 1.6 m with cabin and wheels, plus the low roof rack, wheel diameter 0.80 m. In the TOP view the car is 2.3 times as long as it is wide.

Seen from above it must read at a glance as: a long rectangular blue roof covered by the roof rack grid, the bull bar at the nose.
```
