# WT ISS App

WT ISS App is a training project built to explore Esri ArcGIS APIs and Calcite components. The app tracks the position of the ISS and other satellites on an interactive map, with charts and widgets highlighting orbital passes and live data.

## Key Features

- Tracks the International Space Station (ISS) position
- Displays satellites in orbit and their flight paths
- Uses `@arcgis/core`, `@arcgis/map-components`, and `@arcgis/charts-components`
- UI built with `@esri/calcite-components`
- Global state managed with Redux Toolkit
- Implemented in React on the main branch (`main`)
- Angular version available on the `angular` branch
- Live deployment at: https://wt-iss-app.netlify.app

## Technologies

- React 19
- Vite
- TypeScript
- ArcGIS Maps SDK for JavaScript
- ESRI Calcite Components
- Redux Toolkit
- Tailwind CSS
- satellite.js

## Repository Structure

- `src/`: React app source code
- `src/components/`: UI components and widgets
- `src/hooks/`: custom hooks for map and orbit logic
- `src/lib/`: utilities and calculations for ISS/satellite tracking
- `src/store/`: Redux slices for app state
- `src/types/`: TypeScript type definitions

## Local Setup

```bash
npm install
npm run dev
```

Then open the URL shown by the Vite server (usually `http://localhost:5173`).

## Branches

- `main`: React version of the app
- `angular`: Angular rewrite of the app

## Notes

This project is primarily intended as a practical exercise with Esri APIs and Calcite components, focusing on spatial data visualization and real-time satellite tracking.
