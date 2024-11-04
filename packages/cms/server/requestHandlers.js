import { sendEvent, startEventStream } from './machinery/eventStreams.js'

/** @typedef {ReturnType<typeof createRequestHandlers>} RequestHandlers */

/** @import { DocumentsHandler } from './documents.js' */
/** @import { ImagesHandler } from './images.js' */
/** @import { Streams } from './machinery/eventStreams.js' */

/**
 * @param {{
 *   documents: DocumentsHandler
 *   images: ImagesHandler
 *   streams: Streams
 * }} props
 */
export function createRequestHandlers({ documents, images, streams }) {

  return {

    documents: {
      subscription: {
        HEAD: documents.handleDocumentsSubscribe,
        DELETE: documents.handleDocumentsUnsubscribe,
      },
      single: {
        patch: {
          PATCH: documents.handlePatchDocument,
        },
        subscription: {
          HEAD: documents.handleDocumentSubscribe,
          DELETE: documents.handleDocumentUnsubscribe,
        },
        richText: {
          post: {
            POST: documents.richText.handlePostRichText,
          },
          subscription: {
            HEAD: documents.richText.handleSubscribe,
            DELETE: documents.richText.handleUnsubscribe,
          }
        },
        history: {
          HEAD: documents.history.handleSubscribe,
          DELETE: documents.history.handleUnsubscribe,
        }
      }
    },
    images: {
      post: {
        POST: images.handlePostImage,
      },
      subscription: {
        HEAD: images.handleSubscribe,
        DELETE: images.handleUnsubscribe,
      },
      single: {
        get: {
          GET: images.handleGetImage,
        },

        metadata: {
          patch: {
            PATCH: images.metadata.handlePatchImageMetadata,
          },
          subscription: {
            HEAD: images.metadata.handleSubscribe,
            DELETE: images.metadata.handleUnsubscribe,
          },
        }
      }
    },
    events: {
      connect: {
        GET: (req, res) => streams.connect(res)
      }
    },
    connect: {
      GET: (req, res) => {
        startEventStream(res)
        sendEvent(res, 'connect', null)
      }
    }
  }
}
