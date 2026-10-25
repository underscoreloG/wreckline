# WRAITH - sheet prompt (`wraith`)

| | |
|---|---|
| Concept sheet position | bottom car row, 4th from the left |
| Size (content.md section 1) | 5.2 m long x 2.4 m wide x 0.9 m body height (without cabin), wheel radius 0.46 m |
| Colours | sampled by script from the concept sheet (median of the car's pixels per colour class), checked by eye on a swatch strip |
| Race-camera read | boss: long gunmetal car ringed with spikes, spiked ram at the nose, red skull splash on the hood |

## Prompt (paste as-is, with the concept sheet attached)

```text
Use the attached concept sheet. Draw ONLY the car labelled WRAITH (second row, fourth from the left). Ignore the other cars and the RAVEN strip at the bottom.

Make one game-asset turnaround sheet of this one car, landscape 3:2:
- Top row, left to right: FRONT view, SIDE (facing right) view with the nose pointing to the right edge of the image, REAR view.
- Bottom row, left to right: TOP (nose up) view seen straight from above with the nose pointing to the top edge of the image, then one 3/4 hero view from the front and slightly above, like the concept.
- FRONT, SIDE, REAR and TOP are orthographic (no perspective), at the same scale in every view, standing on one common ground line, with empty space between the views and the whole car visible in each view.
- Plain flat mid-grey background, even soft lighting, no text, no labels, no watermark, no ground shadow, no reflections, no motion blur.

Style: simple low-poly game model, flat planes and chamfered edges, a closed solid body with no see-through gaps. Keep the concept's grunge in the texture, not in the geometry: rust, chipped paint, dirt and scratches are painted on, the surfaces stay flat. Spikes are simple sharp cones. Wheels are simple chunky cylinders. Nothing sticks out sideways past the wheels. No real car brand, badge or logo.

Car: WRAITH, the boss car: a long, heavy armoured muscle sedan covered in steel spikes. A row of long sharp spikes on the front ram bumper pointing forward, shorter spikes along the hood edges, the fenders and the rear wing, armour plates bolted onto the body, a rear wing, chunky tyres on dark rims. Gunmetal grey paint with red paint slashes and a white skull on a red splash on the hood.

Main colors (sampled from the concept sheet): body gunmetal #4E4A47, red slashes and skull splash #A1312B, spikes polished steel #BEB8B1.

Roof: the roof is a plain painted panel in gunmetal #4E4A47 with no decals, no red slashes and no spikes on it, only light wear. The game adds its own roof plate.

Proportions: 5.2 m long x 2.4 m wide x 0.9 m body height (body without the cabin). Overall height about 1.8 m with cabin and wheels, wheel diameter 0.92 m. In the TOP view the car is 2.2 times as long as it is wide, front spikes included.

Seen from above it must read at a glance as: the long gunmetal boss car with spikes all around its outline, the spiked ram at the nose, the red skull splash on the hood and a plain roof.
```
