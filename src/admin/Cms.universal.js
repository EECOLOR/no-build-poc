import { Cms } from '#cms/client/Cms.js'

export default function ConfiguredCms({ basePath, apiPath }) {
  return Cms({ basePath, deskStructure, documentSchemas, documentView, apiPath })
}

const deskStructure = {
  pane: pane('list', {
    items: [
      item('pages', {
        child: pane('documentList', { schemaType: 'page' }),
      }),
      item('settings', {
        child: pane('list', {
          items: [
            item('general', {
              child: pane('document', { schemaType: 'generalSettings' })
            })
          ]
        })
      })
    ]
  })
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
  type('page', {
    fields: [
      field('title', 'string'),
      field('meta', 'object', {
        fields: [
          field('author', 'string'),
          field('readTime', 'string'),
        ]
      }),
      field('content', 'rich-text'),
    ],
    preview: doc => ({ title: doc?.title || '[no title yet]' })
  }),
  type('generalSettings', {
    title: 'General settings',
    fields: [
      field('organization', 'string'),
    ],
    preview: doc => ({ title: 'General settings' })
  })
]

function pane(type, props) {
  return { type, ...props }
}

function item(slug, props = {}) {
  if (!props.label) props.label = capitalize(slug)
  return { slug, ...props }
}

function type(type, props = {}) {
  if (!props.title) props.title = capitalize(type)
  return { type, ...props }
}

function field(name, type, props = {}) {
  if (!props.title) props.title = capitalize(name)
  return { type, name, ...props }
}

function capitalize(s) {
  return s && s[0].toUpperCase() + s.slice(1)
}
