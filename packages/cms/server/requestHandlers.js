import * as google from '#auth/google.js'
import { decodeAndVerifyJwt } from '#auth/jwt.js'
import config from '#config'
import { sendEvent, startEventStream } from './machinery/eventStreams.js'
import { getCookies, withRequestJsonBody } from './machinery/request.js'
import { FOUND, noContent, notAuthorized, notFound, redirect, respondJson, setCookie } from './machinery/response.js'

/** @typedef {ReturnType<typeof createRequestHandlers>} RequestHandlers */

/** @import { DocumentsHandler } from './documents.js' */
/** @import { ImagesHandler } from './images.js' */
/** @import { Streams, StreamCollection } from './machinery/eventStreams.js' */

/**
 * @param {{
 *   basePath: string
 *   documents: DocumentsHandler
 *   images: ImagesHandler
 *   streams: Streams
 * }} props
 */
export function createRequestHandlers({ basePath, documents, images, streams }) {

  const channels = byChannel(
    documents.documentEventStreams,
    documents.documentsEventStreams,
    documents.richText.eventStreamCollection,
    documents.history.historyEventStreams,
    images.imagesEventStream,
    images.metadata.metadataEventStream,
  )

  return {
    documents: {
      single: {
        patch: {
          PATCH: documents.handlePatchDocument,
        },
        richText: {
          post: {
            POST: documents.richText.handlePostRichText,
          },
        },
      }
    },
    images: {
      post: {
        POST: images.handlePostImage,
      },
      single: {
        get: {
          GET: images.handleGetImage,
        },

        metadata: {
          patch: {
            PATCH: images.metadata.handlePatchImageMetadata,
          },
        }
      }
    },
    events: {
      connect: {
        GET: (req, res) => streams.connect(res),
      },
      subscription: {
        POST: (req, res, params) => {
          withRequestJsonBody(req, (body, e) => {

            // TODO: error handling
            const { channel, args } = body

            // TODO: incorrect args for channel handling

            const eventStreams = channels[channel]
            const connectId = req.headers['x-connect-id']
            if (!eventStreams.isValid(connectId))
              return notFound(res)

            const { action } = params
            if (action === 'subscribe')
              eventStreams.subscribe(connectId, args)
            if (action === 'unsubscribe')
              eventStreams.unsubscribe(connectId, args)

            noContent(res)
          })
        }
      }
    },
    connect: {
      GET: (req, res) => {
        startEventStream(res)
        sendEvent(res, 'connect', null)
      }
    },
    auth: {
      me: {
        GET: (req, res, { searchParams }) => {
          const cookies = getCookies(req)

          const idProvider = cookies['idp']
          const idToken = cookies['idt']

          if (!idToken || !idProvider || idProvider !== 'google')
            return notAuthorized(res)

          google.withPublicKeys((publicKeys, error) => {
            console.log({ publicKeys, error })
            // TODO error handling
            if (error) {
              console.error(error)
              return notFound(res)
            }

            const { valid, body } = decodeAndVerifyJwt(idToken, publicKeys)
            console.log({ valid, body })
            if (!valid)
              return notAuthorized(res)

            return respondJson(res, 200, { email: body.email })
          })
        }
      },

      google: {
        login: {
          GET: (req, res) => {
            redirect(res, FOUND, google.getLoginUrl())
          }
        },
        callback: {
          GET: (req, res, { searchParams }) => {
            google.handleLoginCallback(searchParams)
              .then(idToken => {
                setCookie(res, 'idt', idToken)
                setCookie(res, 'idp', 'google')
                redirect(res, FOUND, basePath)
              })
              .catch(e => {
                console.error(e)
                notFound(res)
              })
          }
        }
      }
    }
  }
}

/** @param {StreamCollection<any>[]} eventStreams */
function byChannel(...eventStreams) {
  return Object.fromEntries(eventStreams.map(x => [x.channel, x]))
}
