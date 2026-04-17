import type { ImmutableObject } from 'seamless-immutable'

/**
 * User-facing configuration of the Satellite Map widget.
 *
 * @property fetchUrl - URL of a JSON TLE endpoint (e.g. TLE.ivanstanojevic.me).
 * @property channelId - Free-form id used to broadcast the selection to
 *   sibling widgets. Must match the value set in consumer widgets.
 */
export interface Config {
  fetchUrl: string
  channelId: string
}

export type IMConfig = ImmutableObject<Config>
