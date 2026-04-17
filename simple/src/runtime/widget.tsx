import { React, type AllWidgetProps } from 'jimu-core'
import type { IMConfig } from '../config'

/**
 * Minimal demo widget used as a template/scaffold.
 * Renders the widget name and echoes the example config property so the
 * settings panel can be exercised end-to-end.
 */
const Widget = (props: AllWidgetProps<IMConfig>): React.ReactElement => {
  return (
    <div className='jimu-widget m-2'>
      <p>Simple Widget</p>
      <p>exampleConfigProperty: {props.config.exampleConfigProperty}</p>
    </div>
  )
}

export default Widget
