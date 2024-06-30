import { raw, tags } from '/machinery/tags.js'
import CustomComponent from '/features/CustomComponent.universal.js'
import UniversalContainer from './features/UniversalContainer.universal.js'
import MemoryLeak from './features/MemoryLeak.universal.js'
import hydrateComponentsSrc from '/machinery/hydrateComponents.client.js'
import indexSrc from '/index.client.js'
import { ClientConfig } from '/machinery/ClientConfig.js'

const { html, head, body, script, link } = tags

export function IndexHtml({ css, importMap }) {
  return (
    html({ lang: 'en_US' },
      head(
        ClientConfig(),
        script({ type: 'importmap'}, raw(JSON.stringify(importMap))),
        script({ type: 'module', src: indexSrc}),
        script({ type: 'module', defer: true, src: hydrateComponentsSrc }),
        css.map(href =>
          link({ rel: 'stylesheet', type: 'text/css', href })
        ),
      ),
      body(
        MemoryLeak(),
        UniversalContainer(
          CustomComponent({ title: 'The title', content: 'The content' }),
        ),
      )
    )
  )
}
