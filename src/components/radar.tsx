export function Radar({ className = "" }: { className?: string }) {
  return (
    <div className={`radar aspect-square w-[340px] ${className}`} aria-hidden="true">
      <div className="radar-sweep" />
      <div className="radar-ring" />
      <div className="radar-ring" />
      <div className="radar-ring" />
      <div className="radar-cross" />
      <span className="radar-blip" style={{ top: "30%", left: "38%" }} />
      <span className="radar-blip" />
      <span className="radar-blip" />
    </div>
  );
}
