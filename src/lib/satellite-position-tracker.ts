import type { TleSatellite } from "../types";


const SATELLITE_ENDPOINT =
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle";

/**
 * Parses TLE text and returns an array of TleSatellite objects.
 */
function parseTleText(txt: string): TleSatellite[] {
  const lines = txt
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const satellites: TleSatellite[] = [];

  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];
    const noradId = tryParseNoradId(line1);

    satellites.push({ name, line1, line2, noradId });
  }

  return satellites;
}

/**
 * Attempts to parse the NORAD ID from the first TLE line.
 */
function tryParseNoradId(line1: string): number | null {
  // TLE line1: "1 NNNNN..."
  const raw = line1.substring(2, 7).trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

/**
 * Fetch and parse satellite TLE data as array of TleSatellite.
 */
export async function fetchStationsTle(): Promise<TleSatellite[]> {
  const response = await fetch(SATELLITE_ENDPOINT);
  if (!response.ok) {
    throw new Error(`TLE fetch failed (${response.status})`);
  }
  const txt = await response.text();
  return parseTleText(txt);
}
