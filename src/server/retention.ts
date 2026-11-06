import { purgeExchanges } from "./exchanges.ts";

const HOUR = 60 * 60 * 1000;
const RETENTION = 7 * 24 * HOUR;

function purge() {
  purgeExchanges(new Date(Date.now() - RETENTION));
}

export function startRetention() {
  purge();
  setInterval(purge, HOUR);
}
