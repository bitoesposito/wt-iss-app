import { CommonModule } from '@angular/common'
import { CUSTOM_ELEMENTS_SCHEMA, Component, OnDestroy, computed, inject, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'

import Graphic from '@arcgis/core/Graphic'
import Point from '@arcgis/core/geometry/Point'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer'
import * as geodesicBufferOperator from '@arcgis/core/geometry/operators/geodesicBufferOperator'
import * as intersectsOperator from '@arcgis/core/geometry/operators/intersectsOperator'
import * as projectOperator from '@arcgis/core/geometry/operators/projectOperator'

import { SatelliteOrbitService } from '../../../services/satellite-orbit.service'
import { SatellitesStoreService } from '../../../store/satellites-store'
import type { TleSatellite } from '../../../services/satellites-tle.service'

@Component({
  selector: 'app-satellite-orbit-tracker',
  imports: [CommonModule, FormsModule],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './satellite-orbit-tracker.html',
})
export class SatelliteOrbitTracker implements OnDestroy {
	private readonly satellitesStoreService = inject(SatellitesStoreService)
	private readonly satelliteOrbitService = inject(SatelliteOrbitService)

	readonly satellites = this.satellitesStoreService.satellites
	readonly selectedSatellites = this.satellitesStoreService.selectedSatellites

	readonly point = signal<Point | null>(null)
	readonly bufferKm = signal<number>(100)
	readonly startDay = signal<Date | null>(null)
	readonly endDay = signal<Date | null>(null)
	readonly startTime = signal<string>('00:00')
	readonly endTime = signal<string>('01:00')

	readonly isRunning = signal(false)
	readonly error = signal<string | null>(null)
	readonly results = signal<Array<{ satName: string, startTimestamp: number, endTimestamp: number }>>([])
	readonly isResultsDialogOpen = signal(false)

	readonly areButtonsDisabled = computed(() => this.isRunning() || this.isResultsDialogOpen())

	readonly validation = computed(() => {
		const point = this.point()
		const bufferKm = this.bufferKm()
		const startDay = this.startDay()
		const endDay = this.endDay()
		const startTime = this.startTime()
		const endTime = this.endTime()

		const start = this.combineDayAndTime(startDay, startTime)
		const end = this.combineDayAndTime(endDay, endTime)

		const hasPoint = Boolean(point)
		const isBufferValid = Number.isFinite(bufferKm) && bufferKm >= 10
		const hasStartDay = Boolean(startDay)
		const hasEndDay = Boolean(endDay)
		const isStartTimeValid = Boolean(this.combineDayAndTime(new Date(), startTime))
		const isEndTimeValid = Boolean(this.combineDayAndTime(new Date(), endTime))
		const isRangeValid = Boolean(start && end && start.getTime() < end.getTime())
		const hasSatellites = this.selectedSatellites().length > 0

		return {
			hasPoint,
			isBufferValid,
			hasStartDay,
			hasEndDay,
			isStartTimeValid,
			isEndTimeValid,
			isRangeValid,
			hasSatellites,
		}
	})

	readonly canRunCalculation = computed(() => {
		if (this.areButtonsDisabled()) return false
		if (!this.point()) return false

		const bufferKm = this.bufferKm()
		if (!Number.isFinite(bufferKm) || bufferKm < 10) return false

		const start = this.combineDayAndTime(this.startDay(), this.startTime())
		const end = this.combineDayAndTime(this.endDay(), this.endTime())
		if (!start || !end) return false
		if (start.getTime() >= end.getTime()) return false

		const satellites = this.selectedSatellites()
		if (!satellites.length) return false

		return true
	})

	readonly searchArea = computed(() => {
		const point = this.point()
		const bufferKm = this.bufferKm()
		if (!point) return null
		if (!Number.isFinite(bufferKm) || bufferKm <= 0) return null

		const groundPoint = this.toWgs84GroundPoint(point)

		return geodesicBufferOperator.execute(groundPoint as any, bufferKm, {
			unit: 'kilometers',
		} as any)
	})

	constructor () {
		this.satellitesStoreService.loadStations().catch(() => {})
		geodesicBufferOperator.load().catch(() => {})
		projectOperator.load().catch(() => {})
		this.setDefaultTimeRange()
	}

	ngOnDestroy () {
		this.isResultsDialogOpen.set(false)

		this.point.set(null)
		this.results.set([])
		this.error.set(null)
	}

	get bufferKmValue () {
		return this.bufferKm()
	}

	set bufferKmValue (value: number) {
		this.bufferKm.set(value)
	}

	get startDateTimeLocalValue () {
		return this.startDay()
	}

	set startDateTimeLocalValue (value: Date | null) {
		this.startDay.set(value)
	}

	get endDateTimeLocalValue () {
		return this.endDay()
	}

	set endDateTimeLocalValue (value: Date | null) {
		this.endDay.set(value)
	}

	handleSketchReady (event: unknown) {
		const layer = (event as any)?.target?.layer as GraphicsLayer | null | undefined
		if (!layer) return

		layer.title = 'Pass search - AOI'
		;(layer as any).elevationInfo = { mode: 'on-the-ground' }
	}

	handleSketchCreate (event: unknown) {
		const detail = (event as any)?.detail as
			| { state?: string, graphic?: Graphic | null }
			| undefined
		if (!detail || detail.state !== 'complete') return
		if (!detail.graphic?.geometry) return

		const geometry = detail.graphic.geometry
		if (geometry.type !== 'point') return

		const point = this.toWgs84GroundPoint(geometry as Point)

		this.point.set(point)
		this.error.set(null)
		this.results.set([])
	}

	handleSketchDelete (_event: unknown) {
		this.point.set(null)
		this.error.set(null)
		this.results.set([])
	}

	handleUseNowRange () {
		if (this.areButtonsDisabled()) return

		this.setDefaultTimeRange()
	}

	async handleRunCalculation () {
		if (!this.canRunCalculation()) return

		const searchArea = this.searchArea()
		if (!searchArea) {
			this.error.set('Seleziona un punto e un buffer valido')
			return
		}

		const start = this.combineDayAndTime(this.startDay(), this.startTime())
		const end = this.combineDayAndTime(this.endDay(), this.endTime())
		if (!start || !end || start.getTime() >= end.getTime()) {
			this.error.set('Seleziona un intervallo data/ora valido')
			return
		}

		const satellites = this.selectedSatellites()
		if (!satellites.length) {
			this.error.set('Seleziona almeno un satellite')
			return
		}

		this.isRunning.set(true)
		this.error.set(null)
		this.results.set([])

		try {
			const stepMs = 60 * 1000

			const hits: Array<{ satName: string, startTimestamp: number, endTimestamp: number }> = []

			for (const sat of satellites) {
				const satHits = this.calculateForSatellite({
					sat,
					start,
					end,
					stepMs,
					searchArea,
				})
				hits.push(...satHits)
			}

			hits.sort((a, b) => a.startTimestamp - b.startTimestamp)
			this.results.set(hits)
			this.isResultsDialogOpen.set(true)
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Errore durante il calcolo'
			this.error.set(message)
		} finally {
			this.isRunning.set(false)
		}
	}

	handleOpenResultsDialog () {
		if (this.areButtonsDisabled()) return
		this.isResultsDialogOpen.set(true)
	}

	handleCloseResultsDialog () {
		this.isResultsDialogOpen.set(false)
	}

	private calculateForSatellite (params: {
		sat: TleSatellite
		start: Date
		end: Date
		stepMs: number
		searchArea: unknown
	}) {
		const { sat, start, end, stepMs, searchArea } = params
		const hits: Array<{ satName: string, startTimestamp: number, endTimestamp: number }> = []

		let currentStart: number | null = null
		let lastHit: number | null = null

		for (let t = start.getTime(); t <= end.getTime(); t += stepMs) {
			const loc = this.satelliteOrbitService.getSatelliteLocation(
				new Date(t),
				sat.line1,
				sat.line2,
			)
			if (!loc) continue

			const groundPoint = new Point({
				type: 'point',
				x: loc.x,
				y: loc.y,
				z: 0,
				spatialReference: { wkid: 4326 },
			} as any)

			const intersects = intersectsOperator.execute(
				groundPoint as any,
				searchArea as any,
			)
			if (intersects) {
				if (currentStart === null) currentStart = t
				lastHit = t
				continue
			}

			if (currentStart !== null && lastHit !== null) {
				hits.push({
					satName: sat.name,
					startTimestamp: currentStart,
					endTimestamp: lastHit,
				})
			}

			currentStart = null
			lastHit = null
		}

		if (currentStart !== null && lastHit !== null) {
			hits.push({
				satName: sat.name,
				startTimestamp: currentStart,
				endTimestamp: lastHit,
			})
		}

		return hits
	}

	getPointLat (point: Point): number {
		return (point.latitude ?? point.y) as number
	}

	getPointLon (point: Point): number {
		return (point.longitude ?? point.x) as number
	}

	handleBufferChange (event: Event) {
		if (this.areButtonsDisabled()) return

		const target = event.target as any
		const next = Number(target?.value)
		if (!Number.isFinite(next)) return
		this.bufferKm.set(next)
	}

	handleStartDayChange (event: Event) {
		if (this.areButtonsDisabled()) return

		const target = event.target as any
		const valueAsDate = (target?.valueAsDate ?? null) as Date | Date[] | null
		const day = Array.isArray(valueAsDate) ? valueAsDate[0] : valueAsDate
		this.startDay.set(day ? new Date(day) : null)
	}

	handleEndDayChange (event: Event) {
		if (this.areButtonsDisabled()) return

		const target = event.target as any
		const valueAsDate = (target?.valueAsDate ?? null) as Date | Date[] | null
		const day = Array.isArray(valueAsDate) ? valueAsDate[0] : valueAsDate
		this.endDay.set(day ? new Date(day) : null)
	}

	handleStartTimeChange (event: Event) {
		if (this.areButtonsDisabled()) return

		const target = event.target as any
		const value = (target?.value ?? '') as string
		this.startTime.set(value)
	}

	handleEndTimeChange (event: Event) {
		if (this.areButtonsDisabled()) return

		const target = event.target as any
		const value = (target?.value ?? '') as string
		this.endTime.set(value)
	}

	private combineDayAndTime (day: Date | null, time: string): Date | null {
		if (!day) return null

		const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time)
		if (!match) return null

		const hours = Number(match[1])
		const minutes = Number(match[2])
		const seconds = match[3] ? Number(match[3]) : 0

		if (hours < 0 || hours > 23) return null
		if (minutes < 0 || minutes > 59) return null
		if (seconds < 0 || seconds > 59) return null

		if (
			Number.isNaN(hours) ||
			Number.isNaN(minutes) ||
			Number.isNaN(seconds)
		) return null

		const combined = new Date(day)
		combined.setHours(hours, minutes, seconds, 0)
		return combined
	}

	private toIsoTime (date: Date): string {
		const pad = (v: number) => v.toString().padStart(2, '0')
		return `${pad(date.getHours())}:${pad(date.getMinutes())}`
	}

	private setDefaultTimeRange () {
		const start = new Date()
		const end = new Date(start.getTime() + 60 * 60 * 1000)

		this.startDay.set(new Date(start.getFullYear(), start.getMonth(), start.getDate()))
		this.endDay.set(new Date(end.getFullYear(), end.getMonth(), end.getDate()))
		this.startTime.set(this.toIsoTime(start))
		this.endTime.set(this.toIsoTime(end))
	}

	private toWgs84GroundPoint (point: Point): Point {
		const sr = (point as any)?.spatialReference as { wkid?: number } | undefined

		const projected =
			sr?.wkid === 4326
				? point
				: (projectOperator.execute(point as any, { wkid: 4326 } as any) as
						| Point
						| null
						| undefined)

		if (!projected) {
			return new Point({
				type: 'point',
				x: point.x,
				y: point.y,
				z: 0,
				spatialReference: point.spatialReference,
			} as any)
		}

		return new Point({
			type: 'point',
			x: (projected.longitude ?? projected.x) as number,
			y: (projected.latitude ?? projected.y) as number,
			z: 0,
			spatialReference: { wkid: 4326 },
		} as any)
	}
}
