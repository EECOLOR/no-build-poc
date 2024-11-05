import { asRouteMap } from '#routing/routeMap.js';

/** @import { RequestHandlers } from '#cms/server/requestHandlers.js' */

export const routeMap = asRouteMap({
  api: {
    path: 'api/:version',

    documents: {
      path: 'documents/:type',

      subscription: {
        path: 'subscription',
        data: handler(x => x.documents.subscription)
      },
      single: {
        path: ':id',
        data: handler(x => x.documents.single.patch),

        subscription: {
          path: 'subscription',
          data: handler(x => x.documents.single.subscription)
        },
        richText: {
          path: 'rich-text/:encodedFieldPath',
          data: handler(x => x.documents.single.richText.post),

          subscription: {
            path: 'subscription',
            data: handler(x => x.documents.single.richText.subscription)
          }
        },
        history: {
          path: 'history/subscription',
          data: handler(x => x.documents.single.history)
        }
      }
    },
    images: {
      path: 'images',
      data: handler(x => x.images.post),

      subscription: {
        path: 'subscription',
        data: handler(x => x.images.subscription)
      },
      single: {
        path: ':filename',
        data: handler(x => x.images.single.get),

        metadata: {
          path: 'metadata',
          data: handler(x => x.images.single.metadata.patch),

          subscription: {
            path: 'subscription',
            data: handler(x => x.images.single.metadata.subscription)
          },
        }
      }
    },
    events: {
      path: 'events',
      data: handler(x => x.events.connect)
    },
    connect: {
      path: 'connect',
      data: handler(x => x.connect)
    },
  },
  notFound: '*'
})

/** @typedef {{ [key in ('PATCH' | 'GET' | 'DELETE' | 'HEAD' | 'POST') ]?: any }} Handler */

/**
 * @template T
 * @typedef {any extends T ? never: T} NoAny
 */

/**
 * @template {Handler} T
 * @param {(requestHandlers: RequestHandlers) => NoAny<T>} f */
function handler(f) { return f }
