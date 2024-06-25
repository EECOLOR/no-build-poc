import { raw, tags } from '/machinery/tags.js'
import CustomComponent from '/features/CustomComponent.universal.js'
import UniversalContainer from './features/UniversalContainer.universal.js'
import MemoryLeak from './features/MemoryLeak.universal.js'
// TODO: you probably need a typescript plugin to make this squigly things go away
import hydrateComponentsSrc from '/machinery/hydrateComponents.client.js'
import indexSrc from '/index.client.js'

const { html, head, body, script, link } = tags

export function IndexHtml({ css, importMap }) {
  return (
    html({ lang: 'en_US' },
      head(
        script({ type: 'importmap'}, raw(JSON.stringify(importMap))),
        script({ type: 'module', src: indexSrc}),
        css.map(href =>
          link({ rel: 'stylesheet', type: 'text/css', href })
        ),
      ),
      body(
        MemoryLeak(),
        UniversalContainer(
          CustomComponent({ title: 'The title', content: 'The content' }),
        ),
        script({ type: 'module', src: hydrateComponentsSrc})
      )
    )
  )
}
