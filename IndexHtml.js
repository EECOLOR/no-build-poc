import { tags } from '/tags.js'
import { CustomComponent } from '/CustomComponent.js'
import { Universal } from '/Universal.js'

const { html, head, body, div, script, link } = tags

export function IndexHtml({ css }) {
  return (
    html({ lang: 'en_US' },
      head(
        script({ type: 'module', src: '/index.js'}),
        css.map(href => link({ rel: 'stylesheet', type: 'text/css', href })
        ),
      ),
      body(
        div(
          div('Component below'),
          Universal(CustomComponent, { title: 'The title', content: 'The content' }),
        ),
        script({ type: 'module', src: '/hydrate-components.js'})
      )
    )
  )
}

