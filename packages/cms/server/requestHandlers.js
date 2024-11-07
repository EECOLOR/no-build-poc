import config from '#config'
import { sendEvent, startEventStream } from './machinery/eventStreams.js'
import { withRequestJsonBody } from './machinery/request.js'
import { FOUND, noContent, notFound, redirect } from './machinery/response.js'

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
      google: {
        login: {
          GET: (req, res) => {
            const authConfig = config.google.web
            const searchParams = new URLSearchParams({
              client_id: authConfig.client_id,
              redirect_uri: authConfig.redirect_uri,
              response_type: 'code',
              scope: authConfig.scope,
              // TODO: state - https://developers.google.com/identity/protocols/oauth2/web-server#httprest
            })
            redirect(res, FOUND, `${authConfig.auth_uri}?${searchParams}`)
          }
        },
        callback: {
          GET: (req, res, { searchParams }) => {
            const authConfig = config.google.web
            const error = searchParams.get('error')
            if (error) {
              // TODO: handle error
              console.error(error)
              return notFound(res)
            }

            fetch(authConfig.token_uri, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: new URLSearchParams({
                code: searchParams.get('code'),
                client_id: authConfig.client_id,
                client_secret: authConfig.client_secret,
                redirect_uri: authConfig.redirect_uri,
                grant_type: 'authorization_code',
              })
            })
              .then(async response => {
                const text = await response.text()
                let json
                try {
                  json = JSON.parse(text)
                } catch (e) {
                  throw new Error(`Failed to parse JSON:\n${text}`)
                }
                console.log(json)
              })
              .catch(e => {
                // TODO: error handling
                console.error(e)
              })
              .finally(() => {
                redirect(res, FOUND, basePath)
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
