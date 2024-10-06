import { Cms } from '#cms/client/Cms.js'
import { createCmsConfig } from './cmsConfig.js'

export function ConfiguredCms({ basePath, apiPath }) {
  const { deskStructure, documentSchemas, documentView } = createCmsConfig()
  return Cms({ basePath, deskStructure, documentSchemas, documentView, apiPath })
}

