import styles from './Runtime.css'
import { tags } from '/machinery/tags.js'

const { p } = tags

export function Runtime({ runtime }) {
  return p({ className: styles.title }, `at `, runtime)
}
