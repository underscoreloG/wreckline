export function Position({ position, carCount }: { position: number; carCount: number }) {
  return (
    <div className="pos">
      <span className="pos-n">{position}</span>
      <span className="pos-of">/{carCount}</span>
    </div>
  );
}
