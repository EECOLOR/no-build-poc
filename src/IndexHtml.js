import { raw, tags } from '#ui/tags.js'
import { ClientConfig } from '#ui/ClientConfig.js'
import hydrateComponentsSrc from '#import-universal/hydrate-components.client.js'

import CustomComponent from '/features/CustomComponent.universal.js'
import UniversalContainer from './features/UniversalContainer.universal.js'
import MemoryLeak from './features/MemoryLeak.universal.js'
import indexSrc from '/index.client.js'

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
