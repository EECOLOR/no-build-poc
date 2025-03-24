import { renderDocumentListPane, resolveDocumentListPane } from './DocumentListPane.js'
import { renderListPane, resolveListPane } from './ListPane.js'
import { renderImagesPane, resolveImagesPane } from './ImagesPane.js'
import { renderImagePane } from './ImagePane.js'
import { renderDocumentPane } from './DocumentPane.js'
/**
 * @import { ListPaneConfig } from './ListPane.js'
 * @import { DocumentListPaneConfig } from './DocumentListPane.js'
 * @import { DocumentPaneConfig } from './DocumentPane.js'
 * @import { ImagesPaneConfig } from './ImagesPane.js'
 * @import { ImagePaneConfig } from './ImagePane.js'
 */

export const builtInPaneTypes = /** @type {const} */ ({
  list: {
    Type: /** @type {ListPaneConfig} */ (null),
    resolvePane: resolveListPane,
    renderPane: renderListPane,
  },
  documentList: {
    Type: /** @type {DocumentListPaneConfig} */ (null),
    resolvePane: resolveDocumentListPane,
    renderPane: renderDocumentListPane,
  },
  document: {
    Type: /** @type {DocumentPaneConfig} */ (null),
    renderPane: renderDocumentPane,
  },
  images: {
    Type: /** @type {ImagesPaneConfig} */ (null),
    resolvePane: resolveImagesPane,
    renderPane: renderImagesPane,
  },
  image: {
    Type: /** @type {ImagePaneConfig} */ (null),
    renderPane: renderImagePane,
  }
})
