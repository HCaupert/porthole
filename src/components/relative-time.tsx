import { useEffect, useState } from "react";

const TICK_MS = 10_000;

const units = [
  ["day", 86_400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
] as const;

const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relative(iso: string) {
  const seconds = Math.round((Date.parse(iso) - Date.now()) / 1000);

  const [unit, unitSeconds] =
    units.find(([, candidate]) => Math.abs(seconds) >= candidate) ?? units[3];

  return format.format(Math.round(seconds / unitSeconds), unit);
}

export function RelativeTime({ iso }: { iso: string }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((tick) => tick + 1), TICK_MS);

    return () => clearInterval(timer);
  }, []);

  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()}>
      {relative(iso)}
    </time>
  );
}
