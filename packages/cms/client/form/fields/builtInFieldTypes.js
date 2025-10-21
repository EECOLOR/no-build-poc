import { StringField } from './StringField.js'
import { ObjectField } from './ObjectField.js'
import { ArrayField } from './ArrayField.js'
import { ImageField } from './ImageField.js'
import { ReferenceField } from './ReferenceField.js'
import { RichTextField } from './RichTextField.js'
/**
 * @import { StringFieldConfig } from './StringField.js'
 * @import { ArrayFieldConfig } from './ArrayField.js'
 * @import { ObjectFieldConfig } from './ObjectField.js'
 * @import { ImageFieldConfig } from './ImageField.js'
 * @import { ReferenceFieldConfig } from './ReferenceField.js'
 * @import { RichTextFieldConfig } from './RichTextField.js'
 */

export const builtInFieldTypes = /** @type {const} */ ({
  string: {
    Type: /** @type {StringFieldConfig} */ (null),
    renderField: StringField,
  },
  array: {
    Type: /** @type {ArrayFieldConfig} */ (null),
    renderField: ArrayField,
  },
  object: {
    Type: /** @type {ObjectFieldConfig} */ (null),
    renderField: ObjectField,
  },
  image: {
    Type: /** @type {ImageFieldConfig} */ (null),
    renderField: ImageField,
  },
  reference: {
    Type: /** @type {ReferenceFieldConfig} */ (null),
    renderField: ReferenceField,
  },
  'rich-text': {
    Type: /** @type {RichTextFieldConfig<any>} */ (null),
    renderField: RichTextField,
  },
})
