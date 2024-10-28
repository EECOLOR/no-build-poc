import { conditional, derive, loop, useOnDestroy } from '#ui/dynamic.js'
import { createSignal, Signal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { ButtonAdd, ButtonChevronLeft, ButtonChevronRight, ButtonDelete, Link, List, ListSignal, scrollable } from '../buildingBlocks.js'
import { context, getSchema } from '../context.js'
import { connecting, useDocument, useDocuments, useImageMetadata, useImages } from '../data.js'
import { DocumentForm, patch } from '../form/DocumentForm.js'
import { createImageSrc } from '../form/image/createImgSrc.js'
import { ImageCropAndHotspot } from '../form/image/ImageCropAndHotspot.js'
import { DocumentHistory } from '../history/DocumentHistory.js'
import { debounce } from '../machinery/debounce.js'
import { useElementSize } from '../machinery/elementHooks.js'
import { $pathname, pushState } from '../machinery/history.js'
import { renderOnValue } from '../machinery/renderOnValue.js'
import { useCombined, useSubscriptions } from '../machinery/signalHooks.js'

const { div, input, h1, img, hr } = tags

Desk.style = css`& {
  display: flex;
  flex-direction: column;
  gap: var(--default-gap);
  padding: var(--default-padding);

  & > .Panes {
    height: 100%;
    flex-grow: 1;
  }
}`
export function Desk({ deskStructure }) {
  return (
    div({ className: 'Desk' },
      Desk.style,
      DeskHeader(),
      hr(),
      Panes({ firstPane: deskStructure.pane }),
    )
  )
}

DeskHeader.style = css`& {
  line-height: 1em;
}`
function DeskHeader() {
  return div({ className: 'DeskHeader' }, DeskHeader.style, 'CMS')
}

Panes.style = css`& {
  display: flex;
  min-height: 0; /* display: flex sets it to auto */
  gap: var(--default-gap);

  & > *:not(:last-child) {
    flex-shrink: 0;
  }

  & > :last-child {
    flex-grow: 1;
  }
}`
function Panes({ firstPane }) {
  const $panesWithPath = $pathname.derive(pathname => {
    const pathSegments = pathname.replace(context.basePath, '').slice(1).split('/')
    return resolvePanes(firstPane, pathSegments)
  })

  return (
    div({ className: 'Panes' },
      Panes.style,
      loopWithHr($panesWithPath, x => x.path.join('/'), Pane)
    )
  )
}

/** @type {typeof loop} */
function loopWithHr(signal, getKey, renderItem) {
  const $signalWithHr = signal.derive(a => a.flatMap((x, i) => i ? [Symbol('hr'), x] : [x]))
  return loop(
    $signalWithHr,
    item => {
      const items = signal.get()
      return typeof item === 'symbol' ? item : getKey(item, items.indexOf(item), items)
    },
    item => {
      const items = signal.get()
      return typeof item === 'symbol' ? hr() : renderItem(item, items.indexOf(item), items)
    }
  )
}

function Pane({ pane, path }) {
  const { type } = pane
  return (
    type === 'list' ? ListPane({ items: pane.items, path }) :
    type === 'documentList' ? DocumentListPane({ schemaType: pane.schemaType, path }) :
    type === 'document' ? DocumentPane({ id: pane.id, schemaType: pane.schemaType }) :
    type === 'images' ? ImagesPane({ path }) :
    type === 'image' ? ImagePane({ id: pane.id, path }) :
    `Unknown pane type '${type}'`
  )
}

ListPane.style = css`& {
  max-width: 20rem;
}`
function ListPane({ items, path }) {
  return (
    List(
      {
        className: 'ListPane',
        renderItems: renderItem =>
          items.map(item =>
            renderItem(
              ListItem({
                href: [context.basePath, ...path, item.slug].join('/'),
                title: item.label,
              })
            )
          )
      },
      ListPane.style,
    )
  )
}

DocumentListPane.style = css`& {
  display: flex;
  flex-direction: column;
  max-width: 20rem;
  gap: var(--default-gap);

  & > :last-child {
    flex-grow: 1;
  }
}`
function DocumentListPane({ schemaType, path }) {
  const schema = getSchema(schemaType)
  if (!schema) throw new Error(`Could not find schema '${schemaType}'`)

  const { $documents, setFilter } = useFilteredDocuments({ schema })

  return (
    div({ className: 'DocumentListPane' },
      DocumentListPane.style,
      DocumentListHeader({ schema, onFilterChange: handleFilterChange, onAddClick: handleAddClick }),
      DocumentListItems({ $documents, schema, path })
    )
  )

  function handleAddClick() {
    const newPath = `${context.basePath}/${path.concat(window.crypto.randomUUID()).join('/')}`
    pushState(null, undefined, newPath)
  }

  function handleFilterChange(value) {
    setFilter(value)
  }
}

function useFilteredDocuments({ schema }) {
  const $documents = useDocuments({ schemaType: schema.type })
  const [$filter, setFilter] = createSignal('')
  const $filteredDocuments = useCombined($documents, $filter)
    .derive(([documents, filter]) => documents.filter(doc =>
      schema.preview(doc).title.toLowerCase().includes(filter.toLowerCase()))
    )

  return { $documents: $filteredDocuments, setFilter }
}

DocumentListHeader.style = css`& {
  display: flex;
  gap: var(--default-gap);

  & > input {
    flex-grow: 1;
  }
}`
function DocumentListHeader({ schema, onFilterChange, onAddClick }) {
  return (
    div(
      DocumentListHeader.style,
      input({ type: 'text', onInput: e => onFilterChange(e.currentTarget.value) }),
      ButtonAdd({ title: `Add ${schema.title}`, onClick: onAddClick }),
    )
  )
}

function DocumentListItems({ $documents, schema, path }) {
  return (
    ListSignal({
      signal: $documents,
      getKey: document => document._id,
      renderItem: ({ _id }) => {
        const $document = $documents.derive(documents => documents.find(x => x._id === _id))
        return (
          ListItem({
            href: [context.basePath, ...path, _id].join('/'),
            title: $document.derive(document => schema.preview(document).title),
          })
        )
      }
    })
  )
}

DocumentPane.style = css`& {
  display: flex;
  flex-direction: column;
  gap: var(--default-gap);
  padding: var(--default-padding);
  max-width: fit-content;
}`
function DocumentPane({ id, schemaType }) {
  const $document = useDocument({ id, schemaType })
  const document = { id, schema: getSchema(schemaType), $value: $document }
  const [$showHistory, setShowHistory] = createSignal(false)

  return (
    div(
      DocumentPane.style,
      conditional($document, doc => doc !== connecting, _ => [
        DocumentHeader({ document, $showHistory, onShowHistoryClick: _ => setShowHistory(x => !x) }),
        DocumentBody({ document, $showHistory, id, schemaType }),
      ])
    )
  )
}

DocumentBody.style = css`& {
  display: flex;
  min-height: 0;
  gap: calc(var(--default-gap) * 2);

  & > .DocumentHistory {
    width: 20rem;
  }
}`
function DocumentBody({ document, $showHistory, id, schemaType }) {
  return (
    div({ className: 'DocumentBody' },
      DocumentBody.style,
      DocumentForm({ document }),
      renderOnValue($showHistory,
        _ => DocumentHistory({ id, schemaType }),
      )
    )
  )
}

ImagesPane.style = css`& {
  max-width: 10rem;
  min-width: 10rem;
}`
function ImagesPane({ path }) {
  const $images = useImages()

  return (
    ListSignal(
      {
        className: 'ImagesPane',
        signal: $images,
        getKey: image => image.filename,
        renderItem: image => ImageItem({ image, path })
      },
      ImagesPane.style,
    )
  )
}

function ImageItem({ image, path }) {
  return (
    ListItem({
      href: [context.basePath, ...path, image.filename].join('/'),
      title: div(
        css`& {
          max-height: 5rem;
          width: 5rem;
          padding: calc(var(--default-padding * 2));

          & > img {
            max-height: 100%;
          }
        }`,
        img({ src: `${context.apiPath}/images/${image.filename}` }),
      )
     })
  )
}

ImagePane.style = css`& {
  display: flex;
  gap: var(--default-gap);

  & > .ImageEditor,
  & > .ImagePreview {
    flex-basis: 50%;
    width: 50%;
  }
}`
function ImagePane({ id: filename, path }) {
  const src = `${context.apiPath}/images/${filename}`

  // TODO: we should ignore our own updates
  // Seems this is a general pattern when we listen for live changes
  const $serverMetadata = useImageMetadata({ filename })
  const [$clientMetadata, setClientMetadata] = createSignal({})
  const [$previewMetadata, setPreviewMetadata] = createSignal({})

  useSubscriptions(
    useCombined($serverMetadata, $clientMetadata)
      .subscribe(([serverMetadata, clientMetadata]) => {
        if (serverMetadata === connecting) return
        setPreviewMetadata({ ...serverMetadata, ...clientMetadata })
      }),
    useDebounced($clientMetadata).subscribe(saveMetadata),
  )

  return (
    div(
      ImagePane.style,
      ImageEditor({
        src,
        $serverMetadata,
        onCropChange: crop => setClientMetadata(x => ({ ...x, crop })),
        onHotspotChange: hotspot => setClientMetadata(x => ({ ...x, hotspot })),
      }),
      ImagePreview({ filename, $metadata: $previewMetadata })
    )
  )

  function saveMetadata(metadata) {
    console.log('⎙ save', metadata)
    fetch(`${context.apiPath}/images/${filename}/metadata`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata)
    }) // TODO: error reporting
  }
}

function ImageEditor({ src, $serverMetadata, onCropChange, onHotspotChange }) {
  // TODO: if you balance your height just right, a flickr will start
  // images are shown by ratio, so when the scrollbar is there (and padding is added), the width
  // will be smaller (and thus the height). With the smaller height a scrollbar is no longer needed
  // so the padding and scrollbar are removed, causing the image to be wider. This causes the height
  // to be greater, requiring a scrollbar. (recursion)
  return (
    scrollable.div({ className: 'ImageEditor' },
      conditional($serverMetadata, metadata => metadata !== connecting,
        _ => ImageCropAndHotspot({ src, $metadata: $serverMetadata, onCropChange, onHotspotChange }),
      )
    )
  )
}

ImagePreview.style = css`& {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--default-gap);

  & > * { flex-grow: 1; flex-basis:30%; }
  & > :last-child { flex-basis: 100%; }
}`
function ImagePreview({ filename, $metadata }) {

  return (
    scrollable.div({ className: 'ImagePreview' },
      ImagePreview.style,
      PreviewImage({ filename, aspectRatio: '3 / 4', $metadata }),
      PreviewImage({ filename, aspectRatio: '1 / 1', $metadata }),
      PreviewImage({ filename, aspectRatio: '16 / 9', $metadata }),
      PreviewImage({ filename, aspectRatio: '2 / 1', $metadata }),
    )
  )
}

function PreviewImage({ filename, aspectRatio, $metadata }) {
  const { ref, $size } = useElementSize()
  const $src = useDebounced(useCombined($size, $metadata)).derive(([size, metadata]) =>
    createImageSrc(filename, { ...metadata, ...size })
  )
  return img({ src: $src, ref, style: { aspectRatio } })
}

function useDebounced(signal, milliseconds = 200) {
  const [$debounced, setDebounced] = createSignal(signal.get())

  const debouncedSet = debounce(setDebounced, milliseconds)
  const unsubscribe = signal.subscribe(debouncedSet)
  useOnDestroy(unsubscribe)

  return $debounced
}

DocumentHeader.style = css`& {
  display: flex;
  justify-content: space-between;
  align-items: center;

  & > div {
    display: flex;
  }
}`
function DocumentHeader({ document, $showHistory, onShowHistoryClick }) {
  const $title = document.$value.derive(doc => document.schema.preview(doc).title)
  const $Button = $showHistory.derive(x => x ? ButtonChevronLeft : ButtonChevronRight)

  return (
    div(
      DocumentHeader.style,
      h1($title),
      div(
        ButtonDelete({ onClick: handleDeleteClick }),
        derive($Button, Button =>
          Button({ onClick: onShowHistoryClick })
        )
      )
    )
  )

  function handleDeleteClick() {
    patch({ document, path: '', op: 'remove', fieldType: 'document' })
  }
}

ListItem.style = css`& {
  display: flex;
  text-decoration: none;
  color: inherit;
  justify-content: space-between;
  gap: 1ex;

  &:hover, &.active {
    background-color: lightblue;
  }

  & > button {
    border: none;
  }
}`
function ListItem({ href, title }) {
  const $className = $pathname.derive(pathname => {
    const activeHref = href instanceof Signal ? href.get() : href
    return pathname.startsWith(activeHref) ? 'active' : ''
  })
  return Link({ className: $className, href },
    ListItem.style,
    title,
    ButtonChevronRight({ disabled: true })
  )
}

/** @returns {Array<{ pane: any, path: Array<string> }>} */
function resolvePanes(pane, pathSegments, path = []) {
  if (!pathSegments.length) return [{ pane, path }]

  const [nextPathSegment, ...otherPathSegments] = pathSegments

  if (pane.type === 'list') {
    const item = pane.items.find(x => x.slug === nextPathSegment)
    return [{ pane, path }].concat(
      item
        ? resolvePanes(item.child, otherPathSegments, path.concat(nextPathSegment))
        : []
    )
  }

  if (pane.type === 'documentList') {
    return [
      { pane, path },
      {
        pane: { type: 'document', id: nextPathSegment, schemaType: pane.schemaType },
        path: path.concat(nextPathSegment),
      }
    ]
  }

  if (pane.type === 'images') {
    return [
      { pane, path },
      {
        pane: { type: 'image', id: nextPathSegment },
        path: path.concat(nextPathSegment),
      }
    ]
  }

  return [{ pane, path }]
}
