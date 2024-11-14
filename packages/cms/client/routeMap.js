import { asRouteMap } from '#routing/routeMap.js';

/** @import { RequestHandlers } from '#cms/server/requestHandlers.js' */

export const routeMap = asRouteMap({
  api: {
    path: 'api',

    versioned: {
      path: ':version',

      documents: {
        path: 'documents/:type',

        single: {
          path: ':id',
          data: handler(x => x.documents.single.patch),

          richText: {
            path: 'rich-text/:encodedFieldPath',
            data: handler(x => x.documents.single.richText.post),
          },
        }
      },
      images: {
        path: 'images',
        data: handler(x => x.images.post),

        single: {
          path: ':filename',
          data: handler(x => x.images.single.get),

          metadata: {
            path: 'metadata',
            data: handler(x => x.images.single.metadata.patch),
          }
        }
      },
      events: {
        path: 'events',
        data: handler(x => x.events.connect),

        subscription: {
          path: ':action',
          data: handler(x => x.events.subscription)
        }
      },
      connect: {
        path: 'connect',
        data: handler(x => x.connect)
      },
      me: {
        path: 'me',
        data: handler(x => x.auth.me)
      },
    },

    auth: {
      path: 'auth',

      logout: {
        path: 'logout',
        data: handler(x => x.auth.logout)
      },

      provider: {
        path: ':provider',

        login: {
          path: 'login',
          data: handler(x => x.auth.provider.login)
        },
        callback: {
          path: 'callback',
          data: handler(x => x.auth.provider.callback)
        },
      },
      oauth2: {
        path: 'oauth2',

        authorize: {
          path: 'authorize',
          data: handler(x => x.auth.noAuth.authorize),
        },
        callback: {
          path: 'callback',
          data: handler(x => x.auth.noAuth.callback)
        }
      }
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
