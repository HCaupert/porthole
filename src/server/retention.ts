import { purgeExchanges } from "./exchanges.ts";
import { prunePublications } from "./publications.ts";
import { pruneSubscriptions } from "./subscriptions.ts";

const HOUR = 60 * 60 * 1000;
const RETENTION = 7 * 24 * HOUR;

function purge() {
  const now = Date.now();
  purgeExchanges(new Date(now - RETENTION));
  pruneSubscriptions(new Date(now));
  prunePublications(new Date(now));
}

export function startRetention() {
  purge();
  setInterval(purge, HOUR);
}
