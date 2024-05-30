import styles from './Runtime.css'
import { tags } from '/tags.js'

const { p } = tags

export function Runtime({ runtime }) {
  return p({ class: styles.title }, `at `, runtime)
}
