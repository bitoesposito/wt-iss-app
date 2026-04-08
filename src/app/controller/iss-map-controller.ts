import { Injectable, effect, inject, signal } from '@angular/core';
import { Subscription, switchMap, timer } from 'rxjs';

import { IssTrackerService } from '../services/iss-tracker.service';
import { IssPosition } from '../interfaces/position.interface';
import { PositionStoreService } from '../store/position-store';

type MapGraphics = {
  add: (graphic: unknown) => unknown;
  addMany?: (graphics: unknown[]) => void;
  removeAll?: () => void;
};

type HitTestResult = {
  results?: Array<{
    graphic?: { attributes?: Record<string, unknown> };
  }>;
};

export type IssMapView = {
  goTo?: (target: unknown, options?: unknown) => Promise<unknown>;
  openPopup?: (options?: unknown) => Promise<void>;
  closePopup?: () => Promise<void>;
  hitTest?: (event: unknown) => Promise<HitTestResult>;
};

@Injectable({
  providedIn: 'root',
})
export class IssMapControllerService {
  private readonly FETCH_INTERVAL_MS = 10 * 1000;

  private readonly positions = signal<IssPosition[]>([]);
  private readonly selectedTimestamp = signal<number | null>(null);
  private readonly graphics = signal<MapGraphics | null>(null);
  private readonly view = signal<IssMapView | null>(null);
  private readonly graphicByTimestamp = signal<Map<number, unknown>>(new Map());

  private fetchSubscription: Subscription | undefined;

  private readonly issTrackerService = inject(IssTrackerService);
  private readonly positionStoreService = inject(PositionStoreService);

  constructor() {
    effect(() => {
      const graphics = this.graphics();
      if (!graphics) return;

      this.positions.set(this.positionStoreService.positions());
      this.selectedTimestamp.set(this.positionStoreService.selectedTimestamp());

      graphics.removeAll?.();

      const newGraphics = this.positions().map((position, index) =>
        this.toGraphic(position, index),
      );

      const byTimestamp = new Map<number, unknown>();
      this.positions().forEach((position, index) => {
        byTimestamp.set(position.timestamp, newGraphics[index]);
      });
      this.graphicByTimestamp.set(byTimestamp);

      if (graphics.addMany) {
        graphics.addMany(newGraphics);
        return;
      }

      newGraphics.forEach((graphic) => graphics.add(graphic));
    });

    effect(() => {
      const view = this.view();
      if (!view) return;

      const timestamp = this.positionStoreService.selectedTimestamp();
      if (!timestamp) {
        const closePromise = view.closePopup?.();
        closePromise?.catch(() => {});
        return;
      }

      const intent = this.positionStoreService.selectionIntent();
      const position = this.positionStoreService.positions().find((p) => p.timestamp === timestamp);
      if (!position) return;

      const graphic = this.graphicByTimestamp().get(timestamp);

      if (intent !== 'click') {
        const closePromise = view.closePopup?.();
        closePromise?.catch(() => {});
      }

      const goToPromise = view.goTo?.(
        { center: [position.longitude, position.latitude] },
        { animate: true },
      );

      goToPromise
        ?.then(() => {
          if (intent !== 'click') return;
          if (!graphic) return;

          view.openPopup?.({
            features: [graphic],
            location: (graphic as { geometry?: unknown } | undefined)?.geometry,
          });
        })
        ?.catch(() => {});
    });
  }

  attach(graphics: MapGraphics, view: IssMapView | null) {
    this.graphics.set(graphics);
    this.view.set(view);
  }

  detach() {
    this.stopFetching();
    this.graphics.set(null);
    this.view.set(null);
    this.graphicByTimestamp.set(new Map());
  }

  startFetching() {
    if (this.fetchSubscription) return;

    const initialDelayMs = this.getInitialDelayMs();
    this.fetchSubscription = timer(initialDelayMs, this.FETCH_INTERVAL_MS)
      .pipe(switchMap(() => this.issTrackerService.fetchPosition()))
      .subscribe();
  }

  stopFetching() {
    this.fetchSubscription?.unsubscribe();
    this.fetchSubscription = undefined;
  }

  handleMapClick(event: unknown) {
    const view = this.view();
    if (!view?.hitTest) return;

    view
      .hitTest(event)
      .then((hitTestResult) => {
        const timestamp = this.getTimestampFromHitTest(hitTestResult);
        this.positionStoreService.select(timestamp, 'map');
      })
      .catch(() => {});
  }

  closePopup() {
    const view = this.view();
    const closePromise = view?.closePopup?.();
    closePromise?.catch(() => {});
  }

  private getInitialDelayMs() {
    const latestTimestamp = this.positionStoreService.latestTimestamp();
    if (!latestTimestamp) return 0;

    const nowSec = Math.floor(Date.now() / 1000);
    const secondsSinceLatest = nowSec - latestTimestamp;
    if (secondsSinceLatest < 0) return 0;
    if (secondsSinceLatest >= 10) return 0;

    const delaySec = 10 - secondsSinceLatest;
    return delaySec * 1000;
  }

  private toGraphic(position: IssPosition, index: number) {
    const isLatest = index === 0;
    const isSelected = this.selectedTimestamp() === position.timestamp;
    const timestamp = new Date(position.timestamp * 1000).toLocaleString();

    return {
      geometry: {
        type: 'point',
        longitude: position.longitude,
        latitude: position.latitude,
      },
      symbol: {
        type: 'simple-marker',
        color: isSelected ? [59, 130, 246] : isLatest ? [0, 255, 122] : [148, 163, 184],
        size: isSelected ? 14 : isLatest ? 12 : 8,
        outline: {
          color: [255, 255, 255],
          width: 2,
        },
      },
      attributes: {
        name: isSelected ? 'ISS (selezionata)' : isLatest ? 'ISS (attuale)' : 'ISS',
        timestamp: position.timestamp,
      },
      popupTemplate: {
        title: '{name}',
        content: 'Posizione della ISS al: <br /> <b>' + timestamp + '</b>',
      },
    };
  }

  private getTimestampFromHitTest(hitTestResult: HitTestResult): number | null {
    const results = hitTestResult.results ?? [];

    for (const result of results) {
      const attributes = result.graphic?.attributes;
      const rawTimestamp = attributes?.['timestamp'];

      const timestamp = typeof rawTimestamp === 'number' ? rawTimestamp : Number(rawTimestamp);

      if (Number.isFinite(timestamp)) return timestamp;
    }

    return null;
  }
}
