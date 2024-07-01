import { getPathInformation } from './client-files.js';

export function getPublicPath(url) {
  return getPathInformation(url).publicPath
}
