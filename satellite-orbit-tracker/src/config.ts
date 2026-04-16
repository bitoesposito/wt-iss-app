import type { ImmutableObject } from 'seamless-immutable'

export interface Config {
  channelId: string
}

export type IMConfig = ImmutableObject<Config>
