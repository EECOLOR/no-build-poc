import { startServer } from '#server/devServer.js'
import { IndexHtml } from '/IndexHtml.js'

await startServer({ IndexComponent: IndexHtml })
