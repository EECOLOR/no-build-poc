import { schema } from '#cms/client/form/richTextEditor/schema.js'
import { arrayObject, cmsConfig, field, listItem, pane, document } from '#cms/client/cmsConfig.js'
import { builtInPaneTypes } from '#cms/client/desk/panes/builtInPaneTypes.js'
import { css, tags } from '#ui/tags.js'

const { div } = tags

export function createCmsConfig() {
  return cmsConfig({

    deskStructure: {
      pane: pane('list', {
        items: [
          listItem('pages', {
            child: pane('documentList', { schemaType: 'page' }),
          }),
          listItem('settings', {
            child: pane('list', {
              items: [
                listItem('general', {
                  child: pane('document', { schemaType: 'generalSettings', id: 'general' })
                })
              ]
            })
          }),
          listItem('images', {
            child: pane('images')
          })
        ]
      })
    },
    paneTypes: builtInPaneTypes,
    documentSchemas: [
      document('page', {
        fields: [
          field('title', 'string'),
          field('meta', 'object', {
            title: 'Metadata',
            fields: [
              field('author', 'string'),
              field('readTime', 'string'),
            ],
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
              arrayObject('item', {
                fields: [
                  field('label', 'string'),
                  field('value', 'string'),
                ],
                options: {
                  collapsible: false,
                  showObjectHeader: true,
                }
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
      document('generalSettings', {
        title: 'General settings',
        fields: [
          field('organization', 'string'),
        ],
        preview: doc => ({ title: 'General settings' })
      })
    ],

    documentView,
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

function Custom({ id, $selected }) {
  return (
    div({ style: { outline: $selected.derive(x => x ? 'solid' : 'unset') }, id, css: css`
    display: flex;
    /* user-select: none; */
  `, },
      CustomItem({ title: 'ONE',  backgroundColor: 'red' }),
      CustomItem({ title: 'TWO',  backgroundColor: 'blue' }),
      // tags.span({ contentEditable: true }, ' ')//'\u200b' /* zero width whitespace */) // prevent bug with caret
    )
  )
}

function CustomItem({ title, backgroundColor }) {
  return div({ style: { color: 'white', padding: '0.2rem', backgroundColor } }, title)
}
