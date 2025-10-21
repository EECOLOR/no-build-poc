/**
 * @import { CmsConfig, DocumentSchema, DeskStructure, AsReturnType, Simplify, RequiredParams } from './cmsConfigTypes.ts'
 * @import { ArrayObjectConfig } from './form/fields/ArrayField.js'
 */

import { asConst } from '#typescript/helpers.js'

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
 * @arg {string} name
 * @arg {T} type
 * @arg {RequiredParams<Omit<DocumentSchema.Field<T>, 'name' | 'type'>>} typeParams
 * @returns {AsReturnType<DocumentSchema.Field<T>>}
 */
export function field(name, type, ...typeParams) {
  const [props] = typeParams
  // @ts-expect-error The world changed and now this is not type checking any more
  return { ...defaults(type), ...props, title: props?.title ?? capitalize(name), type, name }
}

/**
 * @template {DocumentSchema.FieldTypes} T
 * @arg {T} type
 * @returns {AsReturnType<DocumentSchema.FieldConfig<T>>}
 */
function defaults(type) {
  switch (type) {
    case 'object':
      const result = /** @type {AsReturnType<DocumentSchema.FieldConfig<'object'>>} */ ({
        options: {
          collapsible: true,
          showObjectHeader: false,
        },
      })
      // @ts-expect-error 'type' is not correctly narrowed to 'object' here, This used to be working when we had `@arg {DocumentSchema.FieldTypes} type @returns {SomeType<typeof type>}`
      return result
    default:
      // @ts-expect-error 'type' is not correctly narrowed to exclude 'object' here, This used to be working when we had `@arg {DocumentSchema.FieldTypes} type @returns {SomeType<typeof type>}`
      return {}
  }
}

/** @template T @arg {T & DocumentSchema.FieldTypes} type @returns {type is DocumentSchema.FieldTypes} */
function isFieldType(type) {
  return true
}

/** @param {string} s */
function capitalize(s) {
  return s && s[0].toUpperCase() + s.slice(1)
}
