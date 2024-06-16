import { tags } from '/machinery/tags.js'
import CustomComponent from '/features/CustomComponent.universal.js'
import hydrateComponentsSrc from '/machinery/hydrateComponents.client.js'
import indexSrc from '/index.client.js'

const { html, head, body, div, script, link } = tags

export function IndexHtml({ css, importMap }) {
  return (
    html({ lang: 'en_US' },
      head(
        script({ type: 'importmap'}, JSON.stringify(importMap)),
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

