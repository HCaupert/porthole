import { purgeExchanges } from "./exchanges.ts";
import { pruneSubscriptions } from "./subscriptions.ts";

const HOUR = 60 * 60 * 1000;
const RETENTION = 7 * 24 * HOUR;

function purge() {
  const now = Date.now();
  purgeExchanges(new Date(now - RETENTION));
  pruneSubscriptions(new Date(now));
}

export function startRetention() {
  purge();
  setInterval(purge, HOUR);
}
