export function HitFlash({ amount }: { amount: number }) {
  return <div className="hit-flash" style={{ opacity: Math.min(1, Math.max(0, amount)) * 0.5 }} />;
}
