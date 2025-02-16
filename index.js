import { startServer } from '#server'

await startServer({
  indexFiles: ['/server/IndexHtml.js', '/server/admin/IndexHtml.js'],
  allowedPackages: [
    '#ui',
    '#cms/client',
    '#routing',
    '#utils/createHash.js',
  ],
  allowedLibraries: [
    'three',

    'firebase/app',
    'firebase/database',
      '@firebase/app',
      '@firebase/component',
      '@firebase/logger',
      '@firebase/util',
      '@firebase/database',
      'idb',

    'prosemirror-collab',
    'prosemirror-commands',
    'prosemirror-history',
    'prosemirror-keymap',
    'prosemirror-model',
    'prosemirror-schema-list',
    'prosemirror-state',
    'prosemirror-view',
    'prosemirror-transform',
      'orderedmap',
      'rope-sequence',
      'w3c-keyname',
  ],
})
