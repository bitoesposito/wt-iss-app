import { Injectable, signal } from '@angular/core'

export type ViewMode = 'iss' | 'satellites'

@Injectable({
  providedIn: 'root',
})
export class ViewModeStoreService {
  readonly viewMode = signal<ViewMode>('iss')

  setViewMode (mode: ViewMode) {
    this.viewMode.set(mode)
  }
}

