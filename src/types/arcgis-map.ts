export type ArcgisLayerCollectionLike = {
  add: (layer: unknown) => void
  remove: (layer: unknown) => void
}

export type ArcgisMapLike = {
  layers: ArcgisLayerCollectionLike
}

export type ArcgisViewLike = {
  map: ArcgisMapLike
  openPopup?: (options?: unknown) => Promise<void>
  closePopup?: () => Promise<void>
  goTo?: (target: unknown, options?: unknown) => Promise<void>
  on?: (eventName: string, handler: (event: unknown) => void) => {
    remove: () => void
  }
  hitTest?: (event: unknown) => Promise<unknown>
}

export type ArcgisMapElementLike = HTMLElement & {
  map?: ArcgisMapLike
  view?: ArcgisViewLike
}

export const getArcgisMapFromElement = (
  mapElement: HTMLElement,
): ArcgisMapLike | null => {
  const maybe = mapElement as unknown as ArcgisMapElementLike
  return maybe.map ?? maybe.view?.map ?? null
}

export const getArcgisViewFromElement = (
  mapElement: HTMLElement,
): ArcgisViewLike | null => {
  const maybe = mapElement as unknown as ArcgisMapElementLike
  return maybe.view ?? null
}