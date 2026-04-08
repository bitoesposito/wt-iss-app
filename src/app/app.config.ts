import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core'
import { provideRouter } from '@angular/router'
import { provideHttpClient } from '@angular/common/http'

import { routes } from './app.routes'
import { providePrimeNG } from 'primeng/config'
import lara from '@primeuix/themes/lara'
import { definePreset, palette } from '@primeuix/themes'

const laraIndigo = definePreset(lara, {
  semantic: {
    primary: palette('{indigo}'),
  },
})

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    providePrimeNG({
      theme: {
        preset: laraIndigo,
        options: {
          darkModeSelector: '.app-dark',
        },
      },
    }),
  ]
}