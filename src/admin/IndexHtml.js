import Cms from './Cms.universal.js'
import { raw, tags } from '#ui/tags.js'
import hydrateComponentsSrc from '#import-universal/hydrate-components.client.js'
import './reset.css'

const { html, head, body, script, link, style } = tags

const basePath = '/admin'

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
        Cms({ deskStructure, documentSchemas, documentView, basePath })
      ),
    )
  )
}

const deskStructure = {
  pane: {
    type: 'list',
    items: [
      {
        label: 'Pages',
        slug: 'pages',
        child: {
          type: 'documentList',
          schemaType: 'page',
        }
      },
      {
        label: 'Settings',
        slug: 'settings',
        child: {
          type: 'list',
          items: [
            {
              label: 'General',
              slug: 'general',
              child: {
                type: 'document',
                id: 'general'
              }
            }
          ]
        }
      }
    ]
  }
}

function documentView({ schemaType }) {
  return {
    tabs: [
      {
        type: 'document'
      }
    ]
  }
}

const documentSchemas = [
  {
    type: 'page',
    fields: [
      {
        type: 'string',
        name: 'title',
        title: 'Title',
      }
    ]
  }
]
