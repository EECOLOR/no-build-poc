import { tags } from '/machinery/tags.js'
import CustomComponent from '/features/CustomComponent.universal.js'
import { urlToFingerprintedPath } from '../server/urlToFingerprintedPath.js'

const { html, head, body, div, script, link } = tags
const hydrateComponentsSrc = await urlToFingerprintedPath('/machinery/hydrate-components.js')
const indexSrc = await urlToFingerprintedPath('/index.js')

export function IndexHtml({ css, importMap }) {
  return (
    html({ lang: 'en_US' },
      head(
        script({ type: 'importmap'}, JSON.stringify(importMap, null, 2)),
        script({ type: 'module', src: indexSrc}),
        css.map(href => link({ rel: 'stylesheet', type: 'text/css', href })
        ),
      ),
      body(
        div(
          div('Component below:'),
          CustomComponent({ title: 'The title', content: 'The content' }),
        ),
        script({ type: 'module', src: hydrateComponentsSrc})
      )
    )
  )
}

