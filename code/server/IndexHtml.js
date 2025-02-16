import { tags } from '#ui/tags.js'

import { CustomComponent } from '/client/features/CustomComponent.js'
import { UniversalContainer } from '/client/features/UniversalContainer.js'
import { MemoryLeak } from '/client/features/MemoryLeak.js'
import { UniversalContainer1 } from '/client/features/UniversalContainer1.js'
import { UniversalContainer2 } from '/client/features/UniversalContainer2.js'
import { ClientConfigProvider, ImportMap, HydrateComponents } from '#ui/islands/setup.js'
import { Island } from '#ui/islands/Island.js'
import { ServerStyles } from '#ui/styles/server.js'

const { html, head, body, b, p, i, br } = tags

export function IndexHtml({ importMap }) {
  return (
    html({ lang: 'en_US' },
      head(
        ClientConfigProvider(),
        ImportMap({ importMap }),
        HydrateComponents(),
      ),
      body(
        ServerStyles(() => [
          Island('/client/features/MemoryLeak.js', MemoryLeak),
          Island('/client/features/UniversalContainer1.js', UniversalContainer1,
            'banana',
            br(), // TODO: this should be self closing
            b('apple'),
          ),
          Island('/client/features/UniversalContainer.js', UniversalContainer,
            Island('/client/features/CustomComponent.js', CustomComponent,
              { title: 'The title', content: 'The content' }
            ),
          ),
          Island('/client/features/UniversalContainer2.js', UniversalContainer2,
            p(b('orange')),
            p('melon'),
            p(i('kiwi')),
          ),
        ])
      )
    )
  )
}
