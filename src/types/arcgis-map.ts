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
  element: HTMLElement,
): ArcgisMapLike | null => {
  const el = element as unknown as ArcgisMapElementLike
  return el.map ?? el.view?.map ?? null
}

export const getArcgisViewFromElement = (
  element: HTMLElement,
): ArcgisViewLike | null => {
  const el = element as unknown as ArcgisMapElementLike
  return el.view ?? null
}

export const waitForView = async (
  element: HTMLElement,
  isCancelled: () => boolean,
): Promise<ArcgisViewLike | null> => {
  while (!isCancelled() && !getArcgisViewFromElement(element)) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  if (isCancelled()) return null

  const view = getArcgisViewFromElement(element)
  if (!view) return null

  const maybeWhen = view as unknown as { when?: () => Promise<unknown> }
  if (typeof maybeWhen.when === 'function') {
    try {
      await maybeWhen.when()
    } catch {
      return null
    }
  }

  return view
}