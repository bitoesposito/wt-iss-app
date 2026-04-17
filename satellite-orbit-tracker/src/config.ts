import type { ImmutableObject } from 'seamless-immutable'

/**
 * User-facing configuration of the Satellite Orbit Tracker widget.
 *
 * @property channelId - Free-form id used to receive selection updates
 *   from a sibling publisher widget (typically the Satellite Map widget).
 *   Must match the upstream id exactly.
 */
export interface Config {
  channelId: string
}

export type IMConfig = ImmutableObject<Config>
