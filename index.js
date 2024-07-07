import { startServer } from '#server/devServer.js'
import { IndexHtml } from '/IndexHtml.js'
import { app } from '#dependency-analysis/app.js'

const { clientFiles, cssFiles } = app

await startServer({ IndexComponent: IndexHtml, clientFiles, cssFiles })
