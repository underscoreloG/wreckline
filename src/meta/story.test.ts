import { describe, expect, it } from 'vitest';
import type { RaceOffer, SaveGame, StoryScene } from '../shared/contracts';
import { BEATS, ENDING, LIEUTENANT_LINES, SPEAKERS, STAGE_LINES, TRACK_LINES } from '../content/story';
import { TRACKS } from '../content/tracks';
import { newCareer, rankOf } from './career';
import { endingScene, lieutenantOf, passedBeats, storySceneFor, storyStage, withSceneSeen } from './story';

const BEAT_IDS = BEATS.map((b) => b.id);

/** A new career moved to ladder rank `rank` (points just above the rival ranked `rank`), with `patch` on top. */
function atRank(rank: number, patch: Partial<SaveGame> = {}): SaveGame {
  const s = newCareer(1);
  const pts = s.rivals.map((r) => r.points).sort((a, b) => b - a);
  const save = { ...s, racesRun: 5, points: rank === 20 ? 0 : (pts[rank - 1] ?? 0) + 1, ...patch };
  if (rankOf(save) !== rank) throw new Error(`atRank(${rank}) gave rank ${rankOf(save)}`);
  return save;
}

/** Every beat before `id` already seen. */
const seenBefore = (id: string): string[] => BEAT_IDS.slice(0, BEAT_IDS.indexOf(id));

const offer = (trackId: string, rivals: string[], tier: RaceOffer['tier'] = 'medium'): RaceOffer => ({
  id: `0-${tier}`,
  tier,
  trackId,
  reversed: false,
  laps: 3,
  rivals,
  prizes: [1000, 500, 250, 0],
  sabotagePrice: 300,
  points: [6, 4, 2, 0],
});

/** No lieutenant: ROOK, BRISKET, SPROCKET. */
const plain = offer('dockside', ['r01', 'r02', 'r03']);

describe('story beats (CCR-12)', () => {
  it('a new career plays beat-intro before its first race, then track scenes', () => {
    const save = newCareer(7);
    const scene = storySceneFor(save, plain);
    expect(scene).toEqual({ id: 'beat-intro', image: 'beat-intro', lines: [...BEATS[0].lines] });
    expect(scene.lines).toHaveLength(5);
    const seen = withSceneSeen(save, scene.id);
    expect(seen.storySeen).toEqual(['beat-intro']);
    expect(storySceneFor(seen, plain).id).toBe('dockside');
  });

  it('each beat plays at its trigger rank, once', () => {
    const cases: [string, number][] = [
      ['beat-vex', 15],
      ['beat-razor', 10],
      ['beat-duchess', 5],
      ['beat-warden', 1],
    ];
    for (const [id, rank] of cases) {
      // One rank short of the trigger: the track scene.
      expect(storySceneFor(atRank(rank + 1, { storySeen: seenBefore(id) }), plain).id).toBe('dockside');
      const save = atRank(rank, { storySeen: seenBefore(id) });
      const scene = storySceneFor(save, plain);
      expect(scene.id).toBe(id);
      expect(scene.image).toBe(id);
      expect(storySceneFor(withSceneSeen(save, id), plain).id).toBe('dockside');
    }
  });

  it('several beats due at once: only the most advanced plays, the skipped ones are marked seen', () => {
    const save = atRank(4, { storySeen: ['beat-intro'] });
    const scene = storySceneFor(save, plain);
    expect(scene.id).toBe('beat-duchess');
    expect(withSceneSeen(save, scene.id).storySeen).toEqual(['beat-intro', 'beat-vex', 'beat-razor', 'beat-duchess']);
    // A brand-new save jumping straight to rank 1 plays THE WARDEN only.
    expect(storySceneFor(atRank(1, { storySeen: [] }), plain).id).toBe('beat-warden');
  });

  it('a lost boss race plays its scene once per loss, on the beat-warden image; a due beat comes first', () => {
    const save = atRank(2, { storySeen: [...BEAT_IDS], bossLosses: 1 });
    const lost = storySceneFor(save, plain);
    expect(lost.id).toBe('boss-lost-1');
    expect(lost.image).toBe('beat-warden');
    expect(lost.lines.map((l) => l.speaker)).toEqual(['maz', 'maz']);
    const after = withSceneSeen(save, lost.id);
    expect(after.storySeen).toEqual([...BEAT_IDS, 'boss-lost-1']);
    expect(storySceneFor(after, plain).id).toBe('dockside');
    expect(storySceneFor({ ...after, bossLosses: 2 }, plain).id).toBe('boss-lost-2');
    // beat-warden not seen yet (cannot happen in play, but the order holds).
    expect(storySceneFor(atRank(1, { storySeen: seenBefore('beat-warden'), bossLosses: 1 }), plain).id).toBe('beat-warden');
    // After the title THE WARDEN has left: no boss-lost scene.
    expect(storySceneFor({ ...save, championWon: true }, plain).id).toBe('dockside');
  });

  it('beat-ending once the title is won, before the champion screen', () => {
    const save = atRank(1, { storySeen: [...BEAT_IDS] });
    expect(endingScene(save)).toBeNull();
    const champ = { ...save, championWon: true };
    const scene = endingScene(champ);
    expect(scene).toEqual({ id: 'beat-ending', image: 'beat-ending', lines: [...ENDING.lines] });
    expect(endingScene(withSceneSeen(champ, 'beat-ending'))).toBeNull();
    // The ending never counts as a before-race beat.
    expect(storySceneFor(champ, plain).id).toBe('dockside');
  });

  it('track scenes store nothing; withSceneSeen does not duplicate', () => {
    const save = atRank(12, { storySeen: ['beat-intro', 'beat-vex'] });
    expect(withSceneSeen(save, 'dockside')).toBe(save);
    expect(withSceneSeen(save, 'beat-vex')).toBe(save);
  });

  it('migration seeding: the beats a save has passed', () => {
    expect(passedBeats({ racesRun: 0, bestRank: 20, championWon: false })).toEqual([]);
    expect(passedBeats({ racesRun: 3, bestRank: 16, championWon: false })).toEqual(['beat-intro']);
    expect(passedBeats({ racesRun: 9, bestRank: 10, championWon: false })).toEqual(['beat-intro', 'beat-vex', 'beat-razor']);
    expect(passedBeats({ racesRun: 50, bestRank: 1, championWon: true })).toEqual([...BEAT_IDS, 'beat-ending']);
  });
});

describe('track scenes (CCR-12)', () => {
  const base = (patch: Partial<SaveGame> = {}): SaveGame => atRank(18, { storySeen: ['beat-intro'], ...patch });

  it('track line, stage line, then a second track line when no lieutenant races', () => {
    const save = base({ racesRun: 4 });
    const scene = storySceneFor(save, plain);
    const track = TRACK_LINES.dockside;
    expect(scene).toEqual({ id: 'dockside', image: 'dockside', lines: [track[4 % 3], STAGE_LINES[0][4 % 3], track[5 % 3]] });
  });

  it('a reversed offer (CCR-14) shows its base track scene', () => {
    const save = base({ racesRun: 4 });
    expect(storySceneFor(save, { ...plain, reversed: true })).toEqual(storySceneFor(save, plain));
  });

  it('track and stage lines rotate with racesRun', () => {
    const lines = [0, 1, 2, 3].map((n) => storySceneFor(base({ racesRun: n }), plain).lines);
    expect(lines[0][0]).not.toEqual(lines[1][0]);
    expect(lines[1][0]).not.toEqual(lines[2][0]);
    expect(lines[0][1]).not.toEqual(lines[1][1]);
    expect(lines[3]).toEqual(lines[0]);
  });

  it('deterministic: the same save and offer always give the same scene', () => {
    const save = base({ racesRun: 11 });
    const o = offer('neonMile', ['r06', 'r02', 'r16']);
    const a: StoryScene = storySceneFor(save, o);
    expect(storySceneFor(structuredClone(save), structuredClone(o))).toEqual(a);
  });

  it('the stage line follows the rank', () => {
    const stages: [number, number][] = [
      [20, 0],
      [16, 0],
      [15, 1],
      [11, 1],
      [10, 2],
      [6, 2],
      [5, 3],
      [2, 3],
      [1, 4],
    ];
    for (const [rank, stage] of stages) {
      const save = atRank(rank, { storySeen: [...BEAT_IDS] });
      expect(storyStage(save)).toBe(stage);
      expect(storySceneFor(save, plain).lines[1]).toEqual(STAGE_LINES[stage][save.racesRun % 3]);
    }
    expect(storyStage(atRank(9, { championWon: true }))).toBe(4);
  });

  it('the lieutenant line: the lieutenant ranked highest on the ladder, THE WARDEN in the boss race', () => {
    const save = base({ racesRun: 7 });
    const vex = offer('redrock', ['r01', 'r06', 'r02']);
    expect(lieutenantOf(save, vex)).toBe('r06');
    expect(storySceneFor(save, vex).lines[2]).toEqual(LIEUTENANT_LINES.r06[7 % 3]);
    // RAZOR (r10) outranks VEX (r06) at the start; once VEX has more points he is picked.
    const both = offer('redrock', ['r06', 'r10', 'r01']);
    expect(lieutenantOf(save, both)).toBe('r10');
    const vexAhead = { ...save, rivals: save.rivals.map((r) => (r.driverId === 'r06' ? { ...r, points: 99 } : r)) };
    expect(lieutenantOf(vexAhead, both)).toBe('r06');
    const top = offer('blastPit', ['r16', 'r19', 'r10']);
    expect(lieutenantOf(save, top)).toBe('r19');
    const bossRace = offer('blastPit', ['boss', 'r19', 'r18'], 'boss');
    expect(lieutenantOf(save, bossRace)).toBe('boss');
    expect(storySceneFor(save, bossRace).lines[2].speaker).toBe('warden');
    expect(lieutenantOf(save, plain)).toBeNull();
  });
});

/** The imported images (scripts/assets/importStory.mjs); keys only, nothing is loaded. */
const IMAGES = Object.keys(import.meta.glob('../../public/story/*.webp'));

describe('story content (CCR-12)', () => {
  const scenes: StoryScene[] = [
    ...BEATS.map((b) => ({ id: b.id, image: b.id, lines: [...b.lines] })),
    { id: ENDING.id, image: ENDING.id, lines: [...ENDING.lines] },
  ];

  it('every track has 3 lines, every stage and lieutenant 3, and every image is in public/story', () => {
    const ids = Object.keys(TRACKS);
    expect(Object.keys(TRACK_LINES).sort()).toEqual([...ids].sort());
    for (const id of ids) expect(TRACK_LINES[id]).toHaveLength(3);
    expect(STAGE_LINES).toHaveLength(5);
    for (const s of STAGE_LINES) expect(s).toHaveLength(3);
    for (const l of Object.values(LIEUTENANT_LINES)) expect(l).toHaveLength(3);
    for (const image of [...BEAT_IDS, ENDING.id, ...ids, 'title-menu']) {
      expect(IMAGES, image).toContain(`../../public/story/${image}.webp`);
    }
  });

  it('every line has a known speaker and plain text (no long dashes, no curly quotes)', () => {
    const all = [...scenes.flatMap((s) => s.lines), ...Object.values(TRACK_LINES).flat(), ...STAGE_LINES.flat(), ...Object.values(LIEUTENANT_LINES).flat()];
    for (const l of all) {
      expect(Object.hasOwn(SPEAKERS, l.speaker), l.speaker).toBe(true);
      expect(l.text).not.toMatch(/[–—‘’“”]/);
      expect(l.text.length).toBeGreaterThan(0);
    }
  });
});
