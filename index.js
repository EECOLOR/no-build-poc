import { startServer } from '#server/devServer.js'

await startServer({ indexFiles: ['/IndexHtml.js', '/admin/IndexHtml.js'] })
