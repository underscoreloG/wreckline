/** Race clock: "1:07.42" (m:ss.cc), centiseconds truncated so a lap never reads faster than it was. */
export function formatTime(seconds: number): string {
  const cs = Math.floor(Math.max(0, seconds) * 100 + 1e-6);
  const m = Math.floor(cs / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

/** Speed readout; reversing shows the magnitude. */
export function formatKmh(kmh: number): string {
  return String(Math.round(Math.abs(kmh)));
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
