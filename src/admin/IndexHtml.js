import Cms from './Cms.universal.js'
import { createCms } from '#cms/server/cms.js'
import { raw, tags } from '#ui/tags.js'
import hydrateComponentsSrc from '#import-universal/hydrate-components.client.js'
import './reset.css'

const { html, head, body, script, link, style } = tags

const basePath = '/admin'
const cms = createCms({ basePath })

export function requestHandler(req, res) {
  if (cms.canHandleRequest(req)) {
    cms.handleRequest(req, res)
    return true
  }
}

export function IndexHtml({ css, importMap }) {
  return (
    html({ lang: 'en_US' },
      head(
        importMap && script({ type: 'importmap'}, raw(JSON.stringify(importMap))),
        script({ type: 'module', defer: true, src: hydrateComponentsSrc }),
        css.map(href =>
          link({ rel: 'stylesheet', type: 'text/css', href })
        ),
        style(`
          * {
            margin: 0;
          }
        `)
      ),
      body(
        Cms({ basePath })
      ),
    )
  )
}
