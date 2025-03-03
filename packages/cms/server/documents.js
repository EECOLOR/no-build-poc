import { createHistoryHandler } from './documents/history.js'
import { createRichTextHandler } from './documents/rich-text.js'
import { deleteAt, getAt, setAt } from './documents/utils.js'
import { withRequestJsonBody } from './machinery/request.js'
import { internalServerError, notAuthorized, respondJson } from './machinery/response.js'

/** @import { DeepReadonly } from '#typescript/utils.ts' */

/** @typedef {ReturnType<typeof createDocumentsHandler>['__for_typescript__patchDocument']} PatchDocument */
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

    __for_typescript__patchDocument: patchDocument,
  }

  function handlePatchDocument(req, res, { type, id, auth }) {
    withRequestJsonBody(req, (body, error) => {
      // TODO: error handling
      if (error) {
        console.error(error)
        return internalServerError(res)
      }
      const { version, patch, userId, fieldType } = body

      if (userId !== auth.user.id)
        return notAuthorized(res)

      const result = patchDocument({ userId, type, id, version, patch, fieldType, fieldInfo: undefined })

      respondJson(res, result.success ? 200 : 400, result)
    })
  }

  /**
   * @template {string} T
   * @param {{
   *   userId: string,
   *   type: string,
   *   id: string,
   *   version: number,
   *   patch: any,
   *   fieldType: T,
   *   fieldInfo: import('./documents/history.js').FieldSpecificInfo<T>, // TODO: move this type somewhere else
   * }} props
   */
  function patchDocument({ userId, type, id, version, patch, fieldType, fieldInfo }) {
    const documentFromDatabase = getDocumentById({ id })
    const isUpdate = Boolean(documentFromDatabase)
    const document = documentFromDatabase || { _id: id, _type: type, version: 0 }

    const expectedVersion = document.version ?? 0
    if (version !== expectedVersion)
      return {
        success: false,
        message: `Incompatible document version, expeced version: ${expectedVersion}`
      }

    const result = applyPatch(document, patch)

    if (!result.success)
      return result

    if (result.operation === 'remove-document') {
      deleteDocumentById({ type, id })
      historyHandler.updateDocumentHistory(userId, type, id, '',
        { fieldType: 'document', patch, oldValue: document, newValue: null },
        undefined,
      )
      return { success: true }
    }

    if (isUpdate) updateDocumentById({ type, id, document })
    else insertDocument({ type, id, document})

    historyHandler.updateDocumentHistory(
      userId, type, id, patch.path,
      {
        fieldType,
        patch,
        oldValue: result.oldValue,
        newValue: result.newValue,
      },
      fieldInfo
    )

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
