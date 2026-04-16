import type { ImmutableObject } from 'seamless-immutable'

export interface Config {
  fetchUrl: string
}

export type IMConfig = ImmutableObject<Config>
