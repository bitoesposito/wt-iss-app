import { Injectable } from '@angular/core'

import * as satellite from 'satellite.js'

export type SatelliteLocation = {
	type: 'point'
	x: number
	y: number
	z: number
	hasZ: true
	spatialReference: { wkid: 4326 }
}

@Injectable({
	providedIn: 'root',
})
export class SatelliteOrbitService {
	getSatelliteLocation (
		date: Date,
		line1: string,
		line2: string,
	): SatelliteLocation | null {
		try {
			const satrec = (satellite as any).twoline2satrec(line1, line2)

			const pv = (satellite as any).propagate(satrec, date)
			if (pv === null) return null

			const positionEci = pv.position
			if (!positionEci) return null

			const gmst = (satellite as any).gstime(date)
			const positionGd = (satellite as any).eciToGeodetic(positionEci, gmst)
			const rad2deg = 180 / Math.PI

			let longitude = positionGd.longitude
			let latitude = positionGd.latitude
			const height = positionGd.height
			if (
				Number.isNaN(longitude) ||
				Number.isNaN(latitude) ||
				Number.isNaN(height)
			) return null

			while (longitude < -Math.PI) longitude += 2 * Math.PI
			while (longitude > Math.PI) longitude -= 2 * Math.PI

			return {
				type: 'point',
				x: rad2deg * longitude,
				y: rad2deg * latitude,
				z: height * 1000,
				hasZ: true,
				spatialReference: { wkid: 4326 },
			}
		} catch {
			return null
		}
	}
}

