// specs/story.md: every line of the career story (CCR-12). Lines are copied from the story bible as written.
import type { StoryLine } from '../shared/contracts';
import { BOSS, RIVALS } from './rivals';

const rival = (driverId: string): { name: string; color: string } => {
  const r = RIVALS.find((x) => x.driverId === driverId);
  if (!r) throw new Error(`unknown rival '${driverId}'`);
  return { name: r.name, color: r.color };
};

/** Speaker ids (StoryLine.speaker): the name shown and its colour (story.md section 5). */
export const SPEAKERS: Readonly<Record<string, { name: string; color: string }>> = {
  maz: { name: 'MAZ', color: '#FF5A1F' },
  warden: { name: BOSS.name, color: BOSS.trim },
  vex: rival('r06'),
  razor: rival('r10'),
  duchess: rival('r16'),
  banshee: rival('r19'),
};

const line =
  (speaker: string) =>
  (text: string): StoryLine => ({ speaker, text });
const maz = line('maz');
const warden = line('warden');
const vex = line('vex');
const razor = line('razor');
const duchess = line('duchess');
const banshee = line('banshee');

/**
 * The beats before a race, in story order; each plays once. A beat is due from the first race at ladder rank `rank`
 * or better (beat-intro: the first race; beat-warden: rank 1, where the boss race is on offer). The image file id is the beat id.
 */
export const BEATS: readonly { id: string; rank: number; lines: readonly StoryLine[] }[] = [
  {
    id: 'beat-intro',
    rank: 20,
    lines: [
      maz('Forty years this garage stood. Took him one race to make it his.'),
      maz("Your old man's brakes didn't fail, kid. Somebody helped them."),
      maz("This is what's left. A RAVEN with more rust than paint. I put the engine back in. Mostly."),
      maz('The Wreckline has twenty slots and you just took the last one. Climb the ladder, and THE WARDEN has to race you for the title.'),
      maz("Win that, and the garage comes home. Lose, and I'm selling your RAVEN for scrap. Go."),
    ],
  },
  {
    id: 'beat-vex',
    rank: 15,
    lines: [
      vex('Well well, the Lantern kid. Heard you crawled out of the scrapyard.'),
      vex('Down here you pay me to race. Up there, you pay THE WARDEN. Everybody pays.'),
      maz('He talks a lot for a man who drives the same car as you and loses.'),
      vex("Enjoy rank fifteen, Lantern. It's as high as strays go."),
    ],
  },
  {
    id: 'beat-razor',
    rank: 10,
    lines: [
      razor("You're climbing. THE WARDEN noticed. That's never good."),
      razor("Last driver who got this high? His car's in there. (he nods at the crusher)"),
      razor('So is he.'),
      maz("Charming. Keep your armour topped up, kid. And don't park near anything with teeth."),
    ],
  },
  {
    id: 'beat-duchess',
    rank: 5,
    lines: [
      duchess("Darling, you're ruining my book. Nobody bet on you. Nobody."),
      duchess('Ten to one against the stray this morning. Three to one now. I hate losing money.'),
      duchess("So here's a tip, free of charge: BANSHEE doesn't brake. Ever."),
      maz("She's helping you because THE WARDEN owes her. Never trust a helpful crook."),
      maz("...But she's right about BANSHEE."),
    ],
  },
  {
    id: 'beat-warden',
    rank: 1,
    lines: [
      banshee('Number one. Fine. Nobody stays there.'),
      warden("The mechanic's stray. I keep your father's sign over my car. It reminds me what borrowed courage is worth."),
      warden('The rule is old: the top of the ladder may challenge me. Win, and the sign is yours. Lose, and I hang your bumper next to it.'),
      warden('I accept.'),
      maz("Kid. Whatever happens, I'm proud of you. Now go and make me prouder."),
    ],
  },
];

/** After the title race win, before the champion screen. */
export const ENDING = {
  id: 'beat-ending',
  lines: [
    maz('The deed. With his signature on it. I had it framed. Twice, in case you crash into the first one.'),
    maz("The Red Lantern's open again. First customer this morning was VEX. Wants his RAVEN fixed. I charged him double."),
    maz('THE WARDEN? Walked off the track and kept walking. Left the helmet. And the league.'),
    maz("Which makes you the one at the top of the Wreckline now, kid. Everybody's coming for you."),
    maz('Good. Garage needs the business.'),
  ],
} as const;

/** Before the race after a lost boss race, on the beat-warden image. */
export const BOSS_LOST = {
  image: 'beat-warden',
  lines: [maz("He's still in the pit, kid. So is the sign. Climb back up."), maz('Next time, hit him first.')],
} as const;

/** Track scene lines by track id (rotate over visits); the image file id is the track id. */
export const TRACK_LINES: Readonly<Record<string, readonly StoryLine[]>> = {
  scrapyard: [
    maz("Home turf. Every wreck in this yard, I've fixed once."),
    maz("Mind the stacks. They fall on whoever's nearest. Usually not me."),
    maz('Your father learned to drive on this yard. Learned to crash here too.'),
  ],
  dustBowl: [
    maz('Dust Bowl. Hot enough to fry the paint off. Keep the windows shut.'),
    maz('Sand in the engine is fine. Sand in the brakes is a funeral.'),
    maz("Fuel's free out here. So are the bullets."),
  ],
  dockside: [
    maz("Dockside. Fall in the water and nobody's fishing you out."),
    maz("Those dockers bet on wrecks. Don't give them the satisfaction."),
    maz('Ninety-degree corners round the stacks. Brake like you mean it.'),
  ],
  frostbite: [
    maz('Frostbite Pass. Three hairpins and a cliff with no rail. Count to three.'),
    maz('Cold engine, cold tyres, hot temper. Wait for the second lap.'),
    maz('If you spin out up here, the wolves get the car.'),
  ],
  neonMile: [
    maz('Neon Mile. Every corner is a right angle and every billboard is THE WARDEN.'),
    maz('City folk love a crash. Give them a show, just not yours.'),
    maz('Blocks are tight. Count the turns, kid. There are a lot.'),
  ],
  redrock: [
    maz('Redrock Quarry. That crane swings over the hairpin. Duck.'),
    maz('Wide bends, then the pinch. Everybody arrives at the pinch together.'),
    maz('They still blast the rock on race days. For atmosphere.'),
  ],
  junkyardSprint: [
    maz('Junkyard Sprint. Short, ugly and violent. My kind of track.'),
    maz('Two hairpins, one at each end. Ram anything in front of you.'),
    maz('Nobody wins clean here. Win dirty, but win.'),
  ],
  pineHollow: [
    maz("Pine Hollow. There's a blind kink in the forest. You'll know it when the trees try to kill you."),
    maz("Fog's thick tonight. Follow the taillights. Or don't, they might be lying."),
    maz('Hunters out here shoot at anything with headlights. Drive fast.'),
  ],
  rainDistrict: [
    maz('Rain District. Chicane after chicane, then the boulevard. Breathe on the boulevard.'),
    maz('Wet road, dry humour. Try to keep one of them.'),
    maz("The cops here are on THE WARDEN's payroll. So, no help."),
  ],
  blastPit: [
    maz('Blast Pit. The longest track in the league. Bring a sandwich.'),
    maz("Between the pits there's a hairpin under the crane. Everyone crashes there once."),
    maz("Miners bet their wages on this one. Don't make them poorer."),
  ],
};

/** Stage lines by story stage 0-4 (rotate inside the stage). */
export const STAGE_LINES: readonly (readonly StoryLine[])[] = [
  [maz("Nobody knows your name yet. Let's fix that."), maz('Rank twenty. Only way is up. Or into a wall.'), maz("Win something. Anything. The rent's due.")],
  [maz("VEX's crew are talking about you. That's progress."), maz('People are starting to bet on you. Small bets. Still.'), maz("Middle of the pack is where cars go to die. Don't stay.")],
  [maz("RAZOR's watching. Keep your doors locked."), maz('Top ten. Your father made it this far. Once.'), maz("They've stopped laughing at the RAVEN jokes. Shame, they were good jokes.")],
  [maz("DUCHESS moved your odds again. You're a favourite now. Terrifying."), maz("BANSHEE doesn't brake. You don't have to beat her, just outlast her."), maz('The sign is close enough to read now, kid.')],
  [
    maz('Top of the ladder. Everyone you passed wants their spot back.'),
    maz("THE WARDEN's in his pit. Waiting. He's patient. You don't have to be."),
    maz('Champion or not, the garage still needs a new roof. Win the prize money.'),
  ],
];

/** Lieutenant lines by driver id (rotate), THE WARDEN's for the boss race. */
export const LIEUTENANT_LINES: Readonly<Record<string, readonly StoryLine[]>> = {
  r06: [vex('Lantern! Save me the spot behind you. I like the view of a wreck.'), vex('Same car as me, kid. Only one of us knows how to drive it.'), vex("Rematch! I wasn't trying last time.")],
  r10: [razor("Your car has good parts. I'd like them."), razor("I don't race. I collect."), razor("Lap two. That's when I come for you.")],
  r16: [duchess("I've a little money on you today, darling. Don't embarrass me."), duchess("Win, and I'll pretend I always believed in you."), duchess("Lose, and I'll pretend I never met you.")],
  r19: [banshee("Don't brake."), banshee("I won't look back. Neither should you."), banshee('Fast. Not fast enough.')],
  [BOSS.driverId]: [warden('Begin.'), warden('Your father had the same look.'), warden("I've already had the sign polished.")],
};
