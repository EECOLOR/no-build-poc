import { schema } from '#cms/client/form/richTextEditor/schema.js'
import { css, tags } from '#ui/tags.js'

const { div } = tags

export function createCmsConfig() {
  return { deskStructure, documentSchemas, documentView }
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
              child: pane('document', { schemaType: 'generalSettings', id: 'general' })
            })
          ]
        })
      }),
      item('images', {
        child: pane('images')
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
      field('heroImage', 'image'),
      field('content', 'rich-text', {
        schema: schema({
          nodes: {
            custom: schema.customComponent('custom', Custom)
          }
        })
      }),
      field('items', 'array', {
        of: [
          type('item', {
            fields: [
              field('label', 'string'),
              field('value', 'string'),
            ]
          })
        ]
      }),
      field('nextItem', 'reference', { title: 'Next item', to: ['page', 'generalSettings']}),
      // next up (don't forget to check for relevant TODO's):
      // - arrays - they present problems when indexes change and with that paths into documents for different kinds of fields
      // - references - can be tricky when we want to keep integrity (prevent removal for referenced documents)
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

function Custom({ id, $selected }) {
  return (
    div({ style: { outline: $selected.derive(x => x ? 'solid' : 'unset') }, id },
      css`& {
        display: flex;
        /* user-select: none; */
      }`,
      CustomItem({ title: 'ONE',  backgroundColor: 'red' }),
      CustomItem({ title: 'TWO',  backgroundColor: 'blue' }),
      // tags.span({ contentEditable: true }, ' ')//'\u200b' /* zero width whitespace */) // prevent bug with caret
    )
  )
}

function CustomItem({ title, backgroundColor }) {
  return div({ style: { color: 'white', padding: '0.2rem', backgroundColor } }, title)
}

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
