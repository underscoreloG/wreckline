# TITAN - sheet prompt (`titan`)

| | |
|---|---|
| Concept sheet position | top row, 3rd from the left |
| Size (content.md section 1) | 5.2 m long x 2.4 m wide x 1.0 m body height (without cabin), wheel radius 0.52 m |
| Colours | sampled by script from the concept sheet (median of the car's pixels per colour class), checked by eye on a swatch strip |
| Race-camera read | biggest car: yellow-and-black tiger truck, turret behind the cab, spiked ram at the nose |

Deviation from the concept: the concept puts the turret on the cab roof. This prompt moves it to a pedestal at the front of the truck bed, so the cab roof stays a plain panel for the game's roof plate and the turret still shows from above.

## Prompt (paste as-is, with the concept sheet attached)

```text
Use the attached concept sheet. Draw ONLY the car labelled TITAN (top row, third from the left). Ignore the other cars and the RAVEN strip at the bottom.

Make one game-asset turnaround sheet of this one car, landscape 3:2:
- Top row, left to right: FRONT view, SIDE (facing right) view with the nose pointing to the right edge of the image, REAR view.
- Bottom row, left to right: TOP (nose up) view seen straight from above with the nose pointing to the top edge of the image, then one 3/4 hero view from the front and slightly above, like the concept.
- FRONT, SIDE, REAR and TOP are orthographic (no perspective), at the same scale in every view, standing on one common ground line, with empty space between the views and the whole car visible in each view.
- Plain flat mid-grey background, even soft lighting, no text, no labels, no watermark, no ground shadow, no reflections, no motion blur.

Style: simple low-poly game model, flat planes and chamfered edges, a closed solid body with no see-through gaps. Keep the concept's grunge in the texture, not in the geometry: rust, chipped paint, dirt and scratches are painted on, the surfaces stay flat. Wheels are simple chunky cylinders. Nothing sticks out sideways past the wheels. No real car brand, badge or logo.

Car: TITAN, a big, heavy armoured pickup truck. Tall boxy cab, a short open truck bed behind it, a huge steel ram plate with forward-pointing spikes and a tubular bull bar on the front, big off-road tyres on dark rims, mud and rust. The gun turret from the concept (a boxy mount with one heavy barrel pointing forward) stands on a pedestal at the front of the truck bed, right behind the cab, its barrel just above the cab roof line. Yellow paint with bold black tiger stripes.

Main colors (sampled from the concept sheet): body yellow #DCA517, tiger stripes black #0E0E0D, bull bar, ram plate and spikes steel #635F5F, rust #593918.

Roof: the cab roof is a plain painted panel in yellow #DCA517 with no decals, no tiger stripes, only light wear. The turret is not on the cab roof, it stands in the bed. The game adds its own roof plate on the cab roof.

Proportions: 5.2 m long x 2.4 m wide x 1.0 m body height (body without the cabin). Overall height about 2.2 m with cab and wheels, plus the turret, wheel diameter 1.04 m. In the TOP view the truck is 2.2 times as long as it is wide, ram plate included.

Seen from above it must read at a glance as: the biggest, widest car, a plain yellow cab roof, the turret in the bed behind it, tiger stripes on the hood and the spiked ram at the nose.
```
