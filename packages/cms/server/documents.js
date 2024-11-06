import { createHistoryHandler } from './documents/history.js'
import { createRichTextHandler } from './documents/rich-text.js'
import { deleteAt, getAt, setAt } from './documents/utils.js'
import { withRequestJsonBody } from './machinery/request.js'
import { respondJson } from './machinery/response.js'

/** @import { DeepReadonly } from '#typescript/utils.ts' */

/** @typedef {ReturnType<typeof createDocumentsHandler>['patchDocument']} PatchDocument */
/** @typedef {DeepReadonly<ReturnType<typeof createDocumentsHandler>>} DocumentsHandler */

/** @param {{ databaseActions: import('./database.js').Actions, streams: import('./machinery/eventStreams.js').Streams }} params */
export function createDocumentsHandler({ databaseActions, streams }) {

  const {
    documentsEventStreams,
    documentEventStreams,

    getDocumentById,
    insertDocument,
    updateDocumentById,
    deleteDocumentById,
  } = databaseActions.documents

  const historyHandler = createHistoryHandler({ databaseActions })
  const richTextHandler = createRichTextHandler({ databaseActions, streams, patchDocument })

  return {
    richText: richTextHandler,
    history: historyHandler,
    handlePatchDocument,
    documentsEventStreams,
    documentEventStreams,
    /* only here so we can expose the type signature */ patchDocument,
  }

  function handlePatchDocument(req, res, { type, id }) {
    withRequestJsonBody(req, (body, error) => {
      // TODO: error handling
      const { version, patch, clientId, fieldType } = body

      const result = patchDocument({ clientId, type, id, version, patch, fieldType })

      respondJson(res, result.success ? 200 : 400, result)
    })
  }

  /**
   * @param {{
   *   clientId: string,
   *   type: string,
   *   id: string,
   *   version: number,
   *   patch: any,
   *   fieldType: string,
   *   steps?: Array<any>
   * }} props
   */
  function patchDocument({ clientId, type, id, version, patch, fieldType, steps = undefined }) {
    const documentFromDatabase = getDocumentById({ id })
    const isUpdate = Boolean(documentFromDatabase)
    const document = documentFromDatabase || { _id: id, _type: type, version: 0 }

    const expectedVersion = document.version ?? 0
    if (version !== expectedVersion)
      return {
        success: false,
        message: `Incompatible document version, expeced version ${expectedVersion}`
      }

    const result = applyPatch(document, patch)

    if (!result.success)
      return result

    if (result.operation === 'remove-document') {
      deleteDocumentById({ type, id })
      historyHandler.updateDocumentHistory(clientId, type, id, '', { fieldType: 'document', patch, oldValue: document, newValue: null })
      return { success: true }
    }

    if (isUpdate) updateDocumentById({ type, id, document })
    else insertDocument({ type, id, document})

    historyHandler.updateDocumentHistory(clientId, type, id, patch.path, {
      fieldType,
      patch,
      oldValue: result.oldValue,
      newValue: result.newValue,
      steps,
    })

    return { success: true }
  }
}

function applyPatch(document, patch) {
  if (patch.path === '' && patch.op !== 'remove')
    return /** @type const */ ({
      success: false,
      message: `Only valid patch operation on document is 'remove', got '${patch.op}'`
    })

  if (patch.path === '' && patch.op === 'remove')
    return /** @type const */ ({
      success: true,
      operation: 'remove-document'
    })

  const operations = {
    // Not rfc6902 (JSON patch) compliant, doesn't do any checking
    replace({ path, value }) {
      setAt(document, path, value)
    },
    move({ from, path }) {
      const removed = operations.remove({ path: from })
      setAt(document, path, removed, { insertIfArray: true })
    },
    remove({ path }) {
      return deleteAt(document, path)
    },
  }
  const applyPatch = operations[patch.op]
  if (!applyPatch)
    throw new Error(`Operation '${patch.op}' not implmented`)

  const oldValue = getAt(document, patch.from || patch.path)
  applyPatch(patch)
  const newValue = getAt(document, patch.path)

  document.version = (document.version ?? 0) + 1

  return /** @type const */ ({
    success: true,
    operation: 'update-document',
    oldValue,
    newValue,
  })
}
