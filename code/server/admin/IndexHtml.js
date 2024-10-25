import { ConfiguredCms } from '/client/admin/ConfiguredCms.js'
import { createCms } from '#cms/server/cms.js'
import { tags } from '#ui/tags.js'
import { Island, ImportMap, HydrateComponents } from '#islands'

const { html, head, body, link } = tags

const basePath = '/admin'
const apiPath = `${basePath}/api`
const storagePath = `./cmsStorage`
const cms = createCms({ basePath, storagePath })

export function requestHandler(req, res) {
  if (cms.canHandleRequest(req)) {
    cms.handleRequest(req, res)
    return true
  }
}

export function IndexHtml({ importMap }) {
  return (
    html({ lang: 'en_US' },
      head(
        ImportMap({ importMap }),
        HydrateComponents(),
        link({ rel: 'stylesheet', type: 'text/css', href: '/static/client/admin/reset.css' })
      ),
      body(
        Island('/client/admin/ConfiguredCms.js', ConfiguredCms, { basePath, apiPath })
      ),
    )
  )
}
