import { raw, tags } from '#ui/tags.js'
import { ClientConfig } from '#ui/ClientConfig.js'
import hydrateComponentsSrc from '#import-universal/hydrate-components.client.js'

import CustomComponent from '/features/CustomComponent.universal.js'
import UniversalContainer from './features/UniversalContainer.universal.js'
import MemoryLeak from './features/MemoryLeak.universal.js'
import indexSrc from '/index.client.js'
import UniversalContainer1 from './features/UniversalContainer1.universal.js'
import UniversalContainer2 from './features/UniversalContainer2.universal.js'

const { html, head, body, script, link, b, p, i, br } = tags

export function IndexHtml({ css, importMap }) {
  return (
    html({ lang: 'en_US' },
      head(
        ClientConfig(),
        importMap && script({ type: 'importmap'}, raw(JSON.stringify(importMap))),
        script({ type: 'module', src: indexSrc}),
        script({ type: 'module', defer: true, src: hydrateComponentsSrc }),
        css.map(href =>
          link({ rel: 'stylesheet', type: 'text/css', href })
        ),
      ),
      body(
        MemoryLeak(),
        UniversalContainer1(
          'banana',
          br(), // TODO: this should be self closing
          b('apple'),
        ),
        UniversalContainer(
          CustomComponent({ title: 'The title', content: 'The content' }),
        ),
        UniversalContainer2(
          p(b('orange')),
          p('melon'),
          p(i('kiwi')),
        ),
      )
    )
  )
}
