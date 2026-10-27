import type { HudState, Vec2 } from '../../shared/contracts';
import { ArenaInfo } from './ArenaInfo';
import { Banner } from './Banner';
import { HitFlash } from './HitFlash';
import { KillFeed } from './KillFeed';
import { LapInfo } from './LapInfo';
import { Minimap } from './Minimap';
import { Position } from './Position';
import { Speedo } from './Speedo';
import { TimeTrialInfo } from './TimeTrialInfo';
import { Vitals } from './Vitals';

/** Race HUD, reads only HudState (15 Hz store updates); smoothing is CSS transitions. */
/**
 * `paused` hides the center stack so banners do not show through the pause menu. A time trial (WP40) shows its own lap
 * readout, no position or vitals; an arena fight (WP41) its cars left and sudden death clock. `names` labels the car
 * the arena camera watches.
 */
export function Hud({ hud, minimapPath, paused = false, names = [] }: { hud: HudState; minimapPath: readonly Vec2[]; paused?: boolean; names?: readonly string[] }) {
  return (
    <div className="hud">
      <HitFlash amount={hud.hitFlash} />
      <div className="hud-tl">
        {hud.timeTrial ? (
          <TimeTrialInfo lap={hud.lap} lapTime={hud.lapTime} trial={hud.timeTrial} />
        ) : hud.arena ? (
          <ArenaInfo arena={hud.arena} carCount={hud.carCount} raceTime={hud.raceTime} spectatingName={hud.arena.spectating !== null ? (names[hud.arena.spectating] ?? null) : null} />
        ) : (
          <>
            <Position position={hud.position} carCount={hud.carCount} />
            <LapInfo lap={hud.lap} laps={hud.laps} lapTime={hud.lapTime} bestLap={hud.bestLap} />
          </>
        )}
      </div>
      <div className="hud-tr">
        {minimapPath.length > 1 && <Minimap path={minimapPath} cars={hud.minimap.cars} />}
        <KillFeed items={hud.killFeed} raceTime={hud.raceTime} />
      </div>
      {!paused && <Banner countdown={hud.countdown} banner={hud.banner} wrongWay={hud.wrongWay} />}
      <div className="hud-bl">
        {!hud.timeTrial && (
          <Vitals
            hp={hud.hp}
            maxHp={hud.maxHp}
            turbo={hud.turbo}
            turboActive={hud.turboActive}
            mines={hud.mines}
            gunHeat={hud.gunHeat}
            gunOverheated={hud.gunOverheated}
          />
        )}
      </div>
      <div className="hud-br">
        <Speedo kmh={hud.speedKmh} />
      </div>
    </div>
  );
}
