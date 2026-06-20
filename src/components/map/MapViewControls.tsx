import '@arcgis/map-components/components/arcgis-zoom'
import '@arcgis/map-components/components/arcgis-navigation-toggle'
import '@arcgis/map-components/components/arcgis-compass'

// Controlli di navigazione comuni alle viste (zoom / toggle / bussola).
// Gli `slot` sono sugli elementi stessi, quindi vengono correttamente
// posizionati anche se renderizzati tramite questo wrapper.
export default function MapViewControls() {
  return (
    <>
      <arcgis-zoom className='pb-3' slot='top-left'></arcgis-zoom>
      <arcgis-navigation-toggle
        className='pb-3'
        slot='top-left'
      ></arcgis-navigation-toggle>
      <arcgis-compass className='pb-3' slot='top-left'></arcgis-compass>
    </>
  )
}
