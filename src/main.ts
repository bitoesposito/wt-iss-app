import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

import '@arcgis/map-components/components/arcgis-map'
import '@arcgis/map-components/components/arcgis-scene'
import '@arcgis/map-components/components/arcgis-zoom'
import '@arcgis/map-components/components/arcgis-navigation-toggle'
import '@arcgis/map-components/components/arcgis-compass'
import '@arcgis/map-components/components/arcgis-expand'
import '@arcgis/map-components/components/arcgis-sketch'

document.documentElement.classList.add('app-dark')

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
