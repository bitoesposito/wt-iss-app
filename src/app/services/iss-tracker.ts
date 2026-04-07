import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { map, Observable, tap } from 'rxjs'

import { IssPosition, IssResponse } from '../interfaces/position.interface'
import { PositionStoreService } from './position-store'

@Injectable({
  providedIn: 'root',
})

export class IssTrackerService {
  private readonly ISS_ENDPOINT = 'http://api.open-notify.org/iss-now.json'

  constructor(
    private readonly http: HttpClient,
    private readonly positionStoreService: PositionStoreService,
  ) {}

  fetchResponse(): Observable<IssResponse> {
    return this.http.get<IssResponse>(this.ISS_ENDPOINT)
  }

  fetchPosition(): Observable<IssPosition> {
    return this.fetchResponse().pipe(
      map((response: IssResponse) => ({
        latitude: Number(response.iss_position.latitude),
        longitude: Number(response.iss_position.longitude),
        timestamp: response.timestamp,
      })),
      tap((position) => this.positionStoreService.add(position))
    )
  }
}
