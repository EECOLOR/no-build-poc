// Here we could switch to a prd server
const server = await import('./devServer.js')

export const startServer = server.startServer
