import type { RaceOffer, SaveGame, StoryLine, StoryScene } from '../shared/contracts';
import { BOSS } from '../content/rivals';
import { BEATS, BOSS_LOST, ENDING, LIEUTENANT_LINES, STAGE_LINES, TRACK_LINES } from '../content/story';
import { ladder, rankOf } from './career';

// Career story scene picking (specs/story.md sections 3-4, CCR-12). Pure and without RNG: the same save and offer
// always give the same scene. The game shows the scene, then stores it with withSceneSeen.

const BOSS_LOST_PREFIX = 'boss-lost-';

/** Story stage by ladder rank: 0 = rank 20-16, 1 = 15-11, 2 = 10-6, 3 = 5-2, 4 = rank 1 or champion. */
export function storyStage(save: SaveGame): number {
  const rank = rankOf(save);
  if (rank === 1 || save.championWon) return 4;
  return rank <= 5 ? 3 : rank <= 10 ? 2 : rank <= 15 ? 1 : 0;
}

/** Lines rotate over the races run, so the same visit always shows the same line. */
const rotate = (lines: readonly StoryLine[], n: number): StoryLine => lines[n % lines.length];

/** THE WARDEN in the boss race, else the lieutenant in the race ranked highest on the ladder, or null. */
export function lieutenantOf(save: SaveGame, offer: RaceOffer): string | null {
  if (offer.rivals.includes(BOSS.driverId)) return BOSS.driverId;
  return ladder(save).find((row) => offer.rivals.includes(row.driverId) && Object.hasOwn(LIEUTENANT_LINES, row.driverId))?.driverId ?? null;
}

function trackScene(save: SaveGame, offer: RaceOffer): StoryScene {
  const track = TRACK_LINES[offer.trackId];
  if (!track) throw new Error(`no story lines for track '${offer.trackId}'`);
  const n = save.racesRun;
  const lt = lieutenantOf(save, offer);
  const last = lt ? rotate(LIEUTENANT_LINES[lt], n) : rotate(track, n + 1);
  return { id: offer.trackId, image: offer.trackId, lines: [rotate(track, n), rotate(STAGE_LINES[storyStage(save)], n), last] };
}

/**
 * The scene before a career race: the most advanced unplayed beat that is due (the lower ones it skips are marked
 * seen with it), else the scene of an unplayed boss loss, else the track scene.
 */
export function storySceneFor(save: SaveGame, offer: RaceOffer): StoryScene {
  const rank = rankOf(save);
  const due = BEATS.filter((b) => rank <= b.rank && !save.storySeen.includes(b.id));
  const beat = due[due.length - 1];
  if (beat) return { id: beat.id, image: beat.id, lines: [...beat.lines] };
  const lost = save.storySeen.filter((id) => id.startsWith(BOSS_LOST_PREFIX)).length;
  // After the title THE WARDEN has left the league: no "he's still in the pit" scene.
  if (save.bossLosses > lost && !save.championWon) return { id: `${BOSS_LOST_PREFIX}${lost + 1}`, image: BOSS_LOST.image, lines: [...BOSS_LOST.lines] };
  return trackScene(save, offer);
}

/** beat-ending once the title race is won, shown before the champion screen; null when there is none to play. */
export function endingScene(save: SaveGame): StoryScene | null {
  if (!save.championWon || save.storySeen.includes(ENDING.id)) return null;
  return { id: ENDING.id, image: ENDING.id, lines: [...ENDING.lines] };
}

/** The save with `sceneId` stored as seen; a beat also stores every earlier beat it skipped. Track scenes store nothing. */
export function withSceneSeen(save: SaveGame, sceneId: string): SaveGame {
  const i = BEATS.findIndex((b) => b.id === sceneId);
  const ids = i >= 0 ? BEATS.slice(0, i + 1).map((b) => b.id) : sceneId === ENDING.id || sceneId.startsWith(BOSS_LOST_PREFIX) ? [sceneId] : [];
  const add = ids.filter((id) => !save.storySeen.includes(id));
  return add.length > 0 ? { ...save, storySeen: [...save.storySeen, ...add] } : save;
}

/**
 * Beats a v1-v3 save has already passed (save migration, CCR-12): every beat up to its best rank once it has raced,
 * and beat-ending when the title is won, so a mid-career save does not replay old beats.
 */
export function passedBeats(save: Pick<SaveGame, 'racesRun' | 'bestRank' | 'championWon'>): string[] {
  const beats = save.racesRun > 0 ? BEATS.filter((b) => save.bestRank <= b.rank).map((b) => b.id) : [];
  return save.championWon ? [...beats, ENDING.id] : beats;
}
