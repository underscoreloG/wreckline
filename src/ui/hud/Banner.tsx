/** Center stack: countdown digit, event banner, WRONG WAY. Each keyed so its scale-in replays on change. */
export function Banner({ countdown, banner, wrongWay }: { countdown: number; banner: string | null; wrongWay: boolean }) {
  const digit = countdown > 0 ? Math.ceil(countdown) : null;
  return (
    <div className="hud-center">
      {digit !== null && (
        <div key={`c${digit}`} className="countdown">
          {digit}
        </div>
      )}
      {banner && (
        <div key={banner} className="banner">
          {banner}
        </div>
      )}
      {wrongWay && <div className="wrong-way blink">WRONG WAY</div>}
    </div>
  );
}
