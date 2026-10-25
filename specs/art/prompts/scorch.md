# SCORCH - sheet prompt (`scorch`)

| | |
|---|---|
| Concept sheet position | bottom car row, 2nd from the left |
| Size (content.md section 1) | 4.8 m long x 2.2 m wide x 0.8 m body height (without cabin), wheel radius 0.42 m |
| Colours | sampled by script from the concept sheet (median of the car's pixels per colour class), checked by eye on a swatch strip |
| Race-camera read | flame-painted muscle car, blower on the hood, black roof, spoiler |

## Prompt (paste as-is, with the concept sheet attached)

```text
Use the attached concept sheet. Draw ONLY the car labelled SCORCH (second row, second from the left). Ignore the other cars and the RAVEN strip at the bottom.

Make one game-asset turnaround sheet of this one car, landscape 3:2:
- Top row, left to right: FRONT view, SIDE (facing right) view with the nose pointing to the right edge of the image, REAR view.
- Bottom row, left to right: TOP (nose up) view seen straight from above with the nose pointing to the top edge of the image, then one 3/4 hero view from the front and slightly above, like the concept.
- FRONT, SIDE, REAR and TOP are orthographic (no perspective), at the same scale in every view, standing on one common ground line, with empty space between the views and the whole car visible in each view.
- Plain flat mid-grey background, even soft lighting, no text, no labels, no watermark, no ground shadow, no reflections, no motion blur.

Style: simple low-poly game model, flat planes and chamfered edges, a closed solid body with no see-through gaps. Keep the concept's grunge in the texture, not in the geometry: rust, chipped paint, dirt and scratches are painted on, the surfaces stay flat. Wheels are simple chunky cylinders. Nothing sticks out sideways past the wheels. No real car brand, badge or logo.

Car: SCORCH, a heavy 1970s-style muscle car. Long hood with a big black supercharger blower sticking up through it, a black roof, a rear spoiler, a steel guard across the front bumper, chunky tyres on dark steel rims. Hot-rod flame paint job: orange and yellow flames running from the nose back along the hood and the sides.

Main colors (sampled from the concept sheet): flame orange #D73B11, flame yellow #EE9D10, roof, blower and trim black #10100F.

Roof: the roof is a plain painted panel in black #10100F with no decals, no flames, no stripes, only light wear. The game adds its own roof plate.

Proportions: 4.8 m long x 2.2 m wide x 0.8 m body height (body without the cabin). Overall height about 1.6 m with cabin and wheels, wheel diameter 0.84 m. In the TOP view the car is 2.2 times as long as it is wide.

Seen from above it must read at a glance as: a wide muscle car with the blower on the hood, flames on the hood and fenders, a black roof and the spoiler across the tail.
```
