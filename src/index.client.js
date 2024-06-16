// If this import was not used in other places, it would not work
import { tags } from '/machinery/tags.js'

console.log('import.client.js:', import.meta)
console.log('import.client.js:', 'create tag', tags.div({ test: 'attribute' }, tags.p('Test content')))
