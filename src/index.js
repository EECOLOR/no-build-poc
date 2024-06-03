import { tags } from '/machinery/tags.js'

console.log(import.meta)

console.log(tags.div({ test: 'attribute' }, tags.p('Test content')))
