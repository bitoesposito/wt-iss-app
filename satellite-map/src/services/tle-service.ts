import type { TleSatellite } from "../types";
import t from "../runtime/translations/default";

function parseTleText(txt: string): TleSatellite[] {
  const lines = txt
    .split("\n")
    .map((l) => l.trim())
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

function tryParseNoradId(line1: string): number | null {
  const raw = line1.substring(2, 7).trim();
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export async function fetchSatellitesTle(url: string): Promise<TleSatellite[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(response.status.toString()) ?? t.fetchUrlError;
  }
  const txt = await response.text();
  return parseTleText(txt);
}
