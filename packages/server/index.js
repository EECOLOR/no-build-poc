import { getPathInformation } from './client-files.js';

// Here we could switch to a prd server
const server = await import('./devServer.js')

export function getPublicPath(url) {
  return getPathInformation(url).publicPath
}

export const startServer = server.startServer
