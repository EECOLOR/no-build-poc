import { raw, tags } from '/machinery/tags.js'
import CustomComponent from '/features/CustomComponent.universal.js'
import CustomContext from './features/CustomContext.universal.js'
// TODO: you probably need a typescript plugin to make this squigly things go away
import hydrateComponentsSrc from '/machinery/hydrateComponents.client.js'
import indexSrc from '/index.client.js'

const { html, head, body, div, script, link } = tags

export function IndexHtml({ css, importMap }) {
  return (
    html({ lang: 'en_US' },
      head(
        script({ type: 'importmap'}, raw(JSON.stringify(importMap))),
        script({ type: 'module', src: indexSrc}),
        css.map(href => link({ rel: 'stylesheet', type: 'text/css', href })
        ),
      ),
      body(
        div(
          CustomContext(
            { color: 'red' },
            div('Component below:'),
            LimitationCannotHaveUniversalAsDirectChildOfUniversal(
              CustomComponent({ title: 'The title', content: 'The content' }),
            ),
          )
        ),
        script({ type: 'module', src: hydrateComponentsSrc})
      )
    )
  )
}

function LimitationCannotHaveUniversalAsDirectChildOfUniversal(...children) {
  return div(...children)
}
