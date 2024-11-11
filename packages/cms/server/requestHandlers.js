import { getLoginUrl, handleLoginCallback } from '#auth/oauth2.js'
import config from '#config'
import { sendEvent, startEventStream } from './machinery/eventStreams.js'
import { withRequestJsonBody } from './machinery/request.js'
import { expireCookie, FOUND, noContent, notAuthorized, notFound, redirect, respondJson, setCookie } from './machinery/response.js'

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
        GET: (req, res, { auth }) => {
          return respondJson(res, 200, auth)
        }
      },

      logout: {
        GET: (req, res) => { oAuth2Logout(res) }
      },

      google: {
        login: {
          GET: (req, res) => { oAuth2Login(res, 'google') }
        },
        callback: {
          GET: (req, res, { searchParams }) => {
            oAuth2LoginCallback(res, searchParams, 'google')
          }
        }
      },

      microsoft: {
        login: {
          GET: (req, res) => { oAuth2Login(res, 'microsoft') }
        },
        callback: {
          GET: (req, res, { searchParams }) => {
            oAuth2LoginCallback(res, searchParams, 'microsoft')
          }
        }
      }
    }
  }

  /** @param {keyof typeof config.auth} idp */
  function oAuth2Login(res, idp) {
    redirect(res, FOUND, getLoginUrl(config.auth[idp].web))
  }

  /** @param {keyof typeof config.auth} idp */
  function oAuth2LoginCallback(res, searchParams, idp) {
    handleLoginCallback(config.auth[idp].web, searchParams)
      .then(idToken => {
        setCookie(res, 'idt', idToken)
        setCookie(res, 'idp', idp)
        redirect(res, FOUND, basePath)
      })
      .catch(e => {
        console.error(e)
        notFound(res)
      })
  }

  function oAuth2Logout(res) {
    expireCookie(res, 'idt')
    expireCookie(res, 'idp')
    redirect(res, FOUND, basePath)
  }
}

/** @param {StreamCollection<any>[]} eventStreams */
function byChannel(...eventStreams) {
  return Object.fromEntries(eventStreams.map(x => [x.channel, x]))
}
