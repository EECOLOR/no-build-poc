import { Cms } from '#cms/client/Cms.js'

export default function ConfiguredCms({ basePath }) {
  return Cms({ basePath, deskStructure, documentSchemas, documentView })
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
                id: 'general',
                schemaType: 'generalSettings'
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
    ],
    preview: doc => ({ title: doc.title || doc._id })
  }
]
