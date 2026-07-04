"use client";

export function Toggle({
  active = false,
  onChange,
}: {
  active?: boolean;
  onChange?: (active: boolean) => void;
}) {
  return (
    <div
      onClick={() => onChange?.(!active)}
      className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${
        active ? "bg-[#ffac02]" : "bg-[#4a2b08]"
      }`}
      role="switch"
      aria-checked={active}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange?.(!active);
        }
      }}
    >
      <div
        className={`w-4 h-4 rounded-full bg-white transition-transform ${
          active ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </div>
  );
}
