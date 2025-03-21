import { ConfiguredCms } from '/client/admin/ConfiguredCms.js'
import { createCms } from '#cms/server/cms.js'
import { tags } from '#ui/tags.js'
import { ImportMap, HydrateComponents } from '#ui/islands/setup.js'
import { Island } from '#ui/islands/Island.js'
import { ServerStyles } from '#ui/styles/server.js'

const { html, head, body, link } = tags

const basePath = '/admin'
const storagePath = `./cmsStorage`
const cms = createCms({ basePath, storagePath })

export function requestHandler(req, res) {
  if (cms.canHandleRequest(req)) {
    cms.handleRequest(req, res)
    return { handled: true }
  }
}

export function IndexHtml({ importMap }) {
  return (
    html({ lang: 'en_US' },
      head(
        ImportMap({ importMap }),
        HydrateComponents(),
        link({ rel: 'stylesheet', type: 'text/css', href: '/static/client/admin/global.css' }),
        link({ rel: 'icon', href: '/static/client/admin/favicon.ico' }),
      ),
      body(
        ServerStyles(() =>
          Island('/client/admin/ConfiguredCms.js', ConfiguredCms, { basePath })
        )
      ),
    )
  )
}
