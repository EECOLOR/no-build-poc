import { DatabaseSync } from 'node:sqlite'
import { createEventStreamCollection } from './machinery/eventStreams.js'

/** @typedef {ReturnType<typeof createDatabaseActions>} Actions */
/** @typedef {import('./machinery/eventStreams.js').Streams} Streams */

export function createDatabaseActions({ database, streams }) {
  return {
    documents: createDocumentActions({ database, streams }),
    history: createHistoryActions({ database, streams }),
    images: createImageActions({ database, streams }),
  }
}

export function createDatabase(file) {
  const database = new DatabaseSync(file)
  // database.exec(`DROP TABLE documents`)
  database.exec(
    `CREATE TABLE IF NOT EXISTS documents (
      id BLOB PRIMARY KEY,
      type BLOB NOT NULL,
      document TEXT NOT NULL
    )`
  )
  // database.exec(`DROP TABLE history`)
  database.exec( // TODO: foreign key to documents
  `CREATE TABLE IF NOT EXISTS history (
    documentId BLOB NOT NULL,
    fieldPath TEXT NOT NULL,
    clientId TEXT NOT NULL,
    timestampStart NUMERIC NOT NULL,
    timestampEnd NUMERIC NOT NULL,
    details TEXT NOT NULL,
    PRIMARY KEY (documentId, clientId, fieldPath, timestampStart)
    )`
  )

  // database.exec(`DROP TABLE images`)
  database.exec(
    `CREATE TABLE IF NOT EXISTS images (
      filename BLOB NOT NULL,
      metadata TEXT NOT NULL,
      PRIMARY KEY (filename)
    )`
  )
  return database
}

/** @param {{ database: DatabaseSync, streams: Streams }} params */
function createDocumentActions({ database, streams }) {
  const documentsEventStreams = createEventStreamCollection({
    eventName: 'documents',
    /** @param {string} type */
    getData(type) {
      return listDocumentsByType({ type })
    },
    streams,
  })
  const documentEventStreams = createEventStreamCollection({
    eventName: 'document',
    /**
     * @param {string} type
     * @param {string} id
     */
    getData(type, id) {
      return getDocumentById({ id })
    },
    streams,
  })
  return {
    documentsEventStreams,
    documentEventStreams,

    listDocumentsByType,
    insertDocument,
    getDocumentById,
    updateDocumentById,
    deleteDocumentById,
  }

  function listDocumentsByType({ type }) {
    /** @type {any} */
    const result = database
      .prepare(`SELECT document FROM documents WHERE type = :type`)
      .all({ type })

    return result.map(x => JSON.parse(x.document))
  }

  function getDocumentById({ id }) {
    /** @type {any} */
    const result = database
      .prepare(`SELECT document FROM documents WHERE id = :id`)
      .get({ id })

    if (!result)
      return null

    const { document } = result
    return JSON.parse(document)
  }

  function insertDocument({ id, type, document }) {
    const result = database
      .prepare(`INSERT INTO documents (id, type, document) VALUES (:id, :type, :document)`)
      .run({ id, type, document: JSON.stringify(document)})

    if (result.changes) notify(type, id)

    return result
  }

  function updateDocumentById({ type, id, document }) {
    const result = database
      .prepare(`UPDATE documents SET document = :document WHERE id = :id`)
      .run({ id, document: JSON.stringify(document) })

    if (result.changes) notify(type, id)

    return result
  }

  function deleteDocumentById({ type, id }) {
    const result = database
      .prepare(`DELETE FROM documents WHERE id = :id`)
      .run({ id })

    if (result.changes) notify(type, id)

    return result
  }

  function notify(type, id) {
    documentEventStreams.notify(type, id)
    documentsEventStreams.notify(type)
  }
}

/** @param {{ database: DatabaseSync, streams: Streams }} params */
function createHistoryActions({ database, streams }) {
  const historyEventStreams = createEventStreamCollection({
    channel: `document/history`,
    eventName: 'history',
    getData(type, documentId) {
      return listHistoryByDocumentId({ documentId })
    },
    streams,
  })

  return {
    historyEventStreams,

    listHistoryByDocumentId,
    getFieldHistoryChangedInTheLastMinute,
    insertHistory,
    updateHistory,
  }

  function listHistoryByDocumentId({ documentId }) {
    const result = database
      .prepare(`
        SELECT fieldPath, clientId, timestampStart, timestampEnd, details
        FROM history
        WHERE documentId = :documentId
        ORDER BY timestampStart DESC
      `)
      .all({ documentId })

    return result.map(/** @param {any} x */ x => ({
      fieldPath: x.fieldPath,
      clientId: x.clientId,
      timestampStart: x.timestampStart,
      timestampEnd: x.timestampEnd,
      details: JSON.parse(x.details),
      key: `${x.clientId}:${x.fieldPath}:${x.timestampStart}`,
    }))
  }

  function getFieldHistoryChangedInTheLastMinute({ documentId, clientId, fieldPath }) {
    const timestamp = Date.now()

    /** @type {any} */
    const result = database
      .prepare(`
        SELECT timestampStart, details
        FROM history
        WHERE documentId = :documentId
        AND clientId = :clientId
        AND fieldPath = :fieldPath
        AND timestampEnd > :timestamp - 60000
        ORDER BY timestampEnd DESC
        LIMIT 1
      `)
      .get({ documentId, clientId, timestamp, fieldPath })

    return result && {
      timestampStart: result.timestampStart,
      details: JSON.parse(result.details)
    }
  }

  function insertHistory({
    type, documentId, fieldPath, clientId,
    timestampStart, timestampEnd, details
  }) {
    const result = database
      .prepare(`
        INSERT INTO history (documentId, fieldPath, clientId, timestampStart, timestampEnd, details)
        VALUES (:documentId, :fieldPath, :clientId, :timestampStart, :timestampEnd, :details)
      `)
      .run({
        documentId, fieldPath, clientId,
        timestampStart, timestampEnd, details: JSON.stringify(details)
      })

    if (result.changes) notify(type, documentId)

    return result
  }

  function updateHistory({
    type,
    select: { documentId, clientId, fieldPath, timestampStart },
    update: { timestampEnd, details }
  }) {
    const result = database
      .prepare(`
        UPDATE history
        SET
          timestampEnd = :timestampEnd,
          details = :details
        WHERE documentId = :documentId
        AND clientId = :clientId
        AND fieldPath = :fieldPath
        AND timestampStart = :timestampStart
      `)
      .run({
        documentId, fieldPath, clientId, timestampStart,
        timestampEnd, details: JSON.stringify(details)
      })

    if (result.changes) notify(type, documentId)

    return result
  }

  function notify(type, documentId) {
    historyEventStreams.notify(type, documentId)
  }
}

/** @param {{ database: DatabaseSync, streams: Streams }} params */
function createImageActions({ database, streams }) {
  const imagesEventStream = createEventStreamCollection({
    eventName: 'images',
    getData() {
      return listImages()
    },
    streams,
  })
  const metadataEventStream = createEventStreamCollection({
    channel: `image/metadata`,
    eventName: 'metadata',
    getData(filename) {
      return getImageMetadataByFilename({ filename })
    },
    streams,
  })

  return {
    imagesEventStream,
    metadataEventStream,

    listImages,
    getImageMetadataByFilename,
    updateImageMetadataByFilename,
    insertImage,
  }

  function listImages() {
    /** @type {any} */
    const result = database
      .prepare(`SELECT * FROM images`)
      .all()
    return result.map(x => ({ ...x, metadata: JSON.parse(x.metadata) }))
  }

  function getImageMetadataByFilename({ filename }) {
    /** @type {any} */
    const result = database
      .prepare(`SELECT metadata FROM images WHERE filename = :filename`)
      .get({ filename })

    if (!result)
      return null

    return JSON.parse(result.metadata)
  }

  function updateImageMetadataByFilename({ filename, metadata }) {
    const result = database
      .prepare(`UPDATE images SET metadata = :metadata WHERE filename = :filename`)
      .run({ filename, metadata: JSON.stringify(metadata) })

    if (result.changes) metadataEventStream.notify(filename)

    return result
  }

  function insertImage({ filename, metadata }) {
    const result = database
      .prepare(`
        INSERT INTO images (filename, metadata)
        VALUES (:filename, :metadata)
      `)
      // TODO: user metadata
      .run({ filename, metadata: JSON.stringify(metadata) })

    if (result.changes) {
      imagesEventStream.notify()
      metadataEventStream.notify(filename)
    }

    return result
  }
}
