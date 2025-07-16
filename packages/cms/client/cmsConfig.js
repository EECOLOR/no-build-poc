/**
 * @import { CmsConfig, DocumentSchema, DeskStructure, AsReturnType, Simplify, RequiredParams } from './cmsConfigTypes.ts'
 * @import { ArrayObjectConfig } from './form/fields/ArrayField.js'
 */

/** @param {CmsConfig} config */
export function cmsConfig(config) {
  return config
}

/**
 * @template {DeskStructure.PaneTypes} T
 * @param {T} type
 * @param {DeskStructure.PaneTypeParams<T>} typeParams
 * @returns {DeskStructure.Pane<T>}
 */
export function pane(type, ...typeParams) {
  const [props] = typeParams
  return { type, ...props }
}

/**
 * @template {DeskStructure.PaneTypes} T
 * @param {string} slug
 * @param {Simplify<Omit<import('./desk/panes/ListPane.js').ListPaneItemConfig<T>, 'slug'>>} props
 * @returns {Simplify<Required<import('./desk/panes/ListPane.js').ListPaneItemConfig<T>>>}
 */
export function listItem(slug, props) {
  return { ...props, label: props.label ?? capitalize(slug), slug }
}

/**
 * @param {string} type
 * @param {Omit<DocumentSchema.DocumentSchema, 'type'>} props
 * @returns {Simplify<Required<DocumentSchema.DocumentSchema>>}
 */
export function document(type, props) {
  // @ts-ignore
  return { ...props, title: props.title ?? capitalize(type), type }
}

/**
 * @param {string} type
 * @param {Omit<ArrayObjectConfig, 'type'>} props
 * @returns {Simplify<Required<ArrayObjectConfig>>}
 */
export function arrayObject(type, props) {
  // @ts-ignore
  return { ...props, title: props.title ?? capitalize(type), type }
}

/**
 * @template {DocumentSchema.FieldTypes} T
 * @param {string} name
 * @param {T} type
 * @param {RequiredParams<Omit<DocumentSchema.Field<T>, 'name' | 'type'>>} typeParams
 * @returns {AsReturnType<DocumentSchema.Field<T>>}
 */
export function field(name, type, ...typeParams) {
  const [props] = typeParams
  return { ...defaults(type), ...props, title: props?.title ?? capitalize(name), type, name }
}

// TODO: this is a more correct version than the previous one, but the return types do not work, seems typescript has changed because the previous one does not work anymore
/**
 * @template T
 * @param {DocumentSchema.FieldTypes} type
 * @returns {AsReturnType<DocumentSchema.FieldConfig<T>>}
 */
function defaults(type) {
  switch (type) {
    case 'object':
      return {
        options: {
          collapsible: true,
          showObjectHeader: false,
        }
      }
    default:
      return {}
  }
}

/** @param {string} s */
function capitalize(s) {
  return s && s[0].toUpperCase() + s.slice(1)
}
