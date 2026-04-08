import { Injectable } from '@angular/core'

export type TleSatellite = {
  name: string
  line1: string
  line2: string
  noradId: number | null
}

@Injectable({
  providedIn: 'root',
})
export class SatellitesTleService {
  async fetchStationsTle (): Promise<TleSatellite[]> {
    const url = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle'
    return this.fetchTle(url)
  }

  async fetchTle (url: string): Promise<TleSatellite[]> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`TLE fetch failed (${response.status})`)
    }

    const txt = await response.text()
    return this.parseTleText(txt)
  }

  parseTleText (txt: string): TleSatellite[] {
    const lines = txt
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    const satellites: TleSatellite[] = []

    for (let i = 0; i + 2 < lines.length; i += 3) {
      const name = lines[i]
      const line1 = lines[i + 1]
      const line2 = lines[i + 2]

      const noradId = this.tryParseNoradId(line1)

      satellites.push({
        name,
        line1,
        line2,
        noradId,
      })
    }

    return satellites
  }

  private tryParseNoradId (line1: string): number | null {
    // TLE line1: "1 NNNNN..."
    const raw = line1.substring(2, 7).trim()
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) return null
    return parsed
  }
}

