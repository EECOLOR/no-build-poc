import { raw, tags } from '#ui/tags.js'
import hydrateComponentsSrc from '#import-universal/hydrate-components.client.js'

const { html, head, body, script, link, b, p, i, br } = tags

export function IndexHtml({ css, importMap }) {
  return (
    html({ lang: 'en_US' },
      head(
        importMap && script({ type: 'importmap'}, raw(JSON.stringify(importMap))),
        script({ type: 'module', defer: true, src: hydrateComponentsSrc }),
        css.map(href =>
          link({ rel: 'stylesheet', type: 'text/css', href })
        ),
      ),
      body(
        p('test')
      ),
    )
  )
}
