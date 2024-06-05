// If this import was not used in other places, it would not work
import { tags } from '/machinery/tags.js'

console.log(import.meta)
console.log('create tag in index.js', tags.div({ test: 'attribute' }, tags.p('Test content')))
