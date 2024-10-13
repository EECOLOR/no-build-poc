import { conditional, derive, loop, useOnDestroy } from '#ui/dynamic.js'
import { createSignal, Signal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { ButtonAdd, ButtonChevronLeft, ButtonChevronRight, ButtonDelete, Link, List, Scrollable } from '../buildingBlocks.js'
import { context, getSchema } from '../context.js'
import { DocumentForm, patch } from '../form/DocumentForm.js'
import { ImageCropAndHotspot } from '../form/image/ImageCropAndHotspot.js'
import { DocumentHistory } from '../history/DocumentHistory.js'
import { debounce } from '../machinery/debounce.js'
import { useElementSize } from '../machinery/elementHooks.js'
import { $pathname, pushState } from '../machinery/history.js'
import { renderOnValue } from '../machinery/renderOnValue.js'
import { useCombined } from '../machinery/useCombined.js'
import { useEventSourceAsSignal } from '../machinery/useEventSourceAsSignal.js'

const { div, input, h1, img, pre, code } = tags

const connecting = Symbol('connecting')

Desk.style = css`& {
  display: flex;
  flex-direction: column;
  height: 100%;

  & > * {
    padding: 0.5rem;
  }

  & > :not(:first-child, :last-child) {
    border-bottom: 1px solid lightgray;
  }

  & > :last-child {
    flex-grow: 1;
  }
}`
export function Desk({ deskStructure }) {
  return (
    div(
      Desk.style,
      DeskHeader(),
      Panes({ firstPane: deskStructure.pane }),
    )
  )
}

function DeskHeader() {
  return div(div(css`& { padding: 0.5rem; }`, 'CMS'))
}

Panes.style = css`& {
  display: flex;
  height: 100%;
  min-height: 0; /* display: flex sets it to auto */

  & > .list {
    max-width: 20rem;
    flex-shrink: 0;
  }

  & > :not(:first-child) {
    border-right: 1px solid lightgray;
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
    div(
      Panes.style,
      loop(
        $panesWithPath,
        x => x.path.join('/'),
        Pane
      )
    )
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
  height: 100%;
  padding: 0.5rem;
}`
function ListPane({ items, path }) {
  return (
    div({ className: 'list' },
      ListPane.style,
      List({ scrollBarPadding: '0.5rem', renderItems: renderItem =>
        items.map(item =>
          renderItem(
            ListItem({
              href: [context.basePath, ...path, item.slug].join('/'),
              title: item.label,
            })
          )
        )
      })
    )
  )
}

DocumentListPane.style = css`& {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0.5rem;

  & > :not(:first-child, :last-child) {
    margin-bottom: 0.5rem;
  }

  & > :last-child {
    flex-grow: 1;
  }
}`
function DocumentListPane({ schemaType, path }) {
  const $documents = useDocuments({ schemaType })
  const schema = getSchema(schemaType)
  if (!schema) throw new Error(`Could not find schema '${schemaType}'`)

  const [$filter, setFilter] = createSignal('')
  const $filteredDocuments = useCombined($documents, $filter)
    .derive(([documents, filter]) => documents.filter(doc =>
      schema.preview(doc).title.toLowerCase().includes(filter.toLowerCase()))
    )

  return (
    div({ className: 'list' },
      DocumentListPane.style,
      DocumentListHeader({ schema, onFilterChange: handleFilterChange, onAddClick: handleAddClick }),
      List({ scrollBarPadding: '0.5rem', renderItems: renderItem =>
        loop($filteredDocuments, x => x._id + hack(x), document => // TODO: document should probably be a signal, if the id does not change, nothing will be re-rendered
          renderItem(
            ListItem({
              href: [context.basePath, ...path, document._id].join('/'),
              title: schema.preview(document).title ,
            })
          )
        )
      })
    )
  )

  function handleAddClick() {
    const newPath = `${context.basePath}/${path.concat(window.crypto.randomUUID()).join('/')}`
    pushState(null, undefined, newPath)
  }

  function handleFilterChange(value) {
    setFilter(value)
  }

  function hack(document) {
    return JSON.stringify(schema.preview(document))
  }
}

DocumentListHeader.style = css`& {
  display: flex;
  gap: 0.5rem;

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

DocumentPane.style = css`& {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.5rem;
  max-width: fit-content;

  & > div {
    display: flex;
    min-height: 0;
    gap: 1rem;
    flex-grow: 1;

  }
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
        div(
          Scrollable({ scrollBarPadding: '0.5rem' },
            DocumentForm({ document }),
          ),
          renderOnValue($showHistory,
            _ => DocumentHistory({ id, schemaType }),
          )
        )
      ])
    )
  )
}

ImagesPane.style = css`& {
  height: 100%;
  padding: 0.5rem;

  & > * {
    height: 100%;
  }
}`
function ImagesPane({ path }) {
  const $images = useImages()

  return (
    div({ className: 'list' },
      ImagesPane.style,
      List({ scrollBarPadding: '0.5rem', renderItems: renderItem =>
        loop(
          $images,
          image => image.filename,
          image => renderItem(ImageItem({ image, path }))
        )
      })
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
          padding: 1rem;

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
  padding: 0.5rem;
  display: flex;
  gap: 1rem;

  & > * {
    height: 100%;
    width: 50%;
  }
}`
function ImagePane({ id, path }) {
  const src = `${context.apiPath}/images/${id}`

  const $serverMetadata = useImageMetadata({ id })
  const [$clientMetadata, setClientMetadata] = createSignal({})

  const $combinedMetadata = useCombined($serverMetadata, $clientMetadata)
    .derive(([serverMetadata, clientMetadata]) =>
      serverMetadata === connecting ? null : { ...serverMetadata, ...clientMetadata, }
    )

  const debouncedSaveMetadata = debounce(saveMetadata, 200)
  const unsubscribe = $combinedMetadata.subscribe(debouncedSaveMetadata)
  useOnDestroy(unsubscribe)

  return (
    div(
      ImagePane.style,
      Scrollable({ scrollBarPadding: '0.5rem' },
        ImageEditor({
          src,
          $serverMetadata,
          onCropChange: handleCropChange,
          onHotspotChange: handleHotspotChange,
        })
      ),
      Scrollable({ scrollBarPadding: '0.5rem' },
        ImagePreview({ src, $metadata: $clientMetadata })
      )
    )
  )

  function handleCropChange(crop) {
    setClientMetadata(x => ({ ...x, crop }))
  }

  function handleHotspotChange(hotspot) {
    setClientMetadata(x => ({ ...x, hotspot }))
  }

  function saveMetadata({ crop, hotspot }) {
    const metadata = $serverMetadata.get()
    if (metadata === connecting) return

    const { width, height } = metadata
    if (!crop) crop = { x: 0, y: 0, width, height }
    if (!hotspot) hotspot = crop

    const url = `http://localhost:8000/admin/api/2024-09-07/images/f65fc08d-a8df-4ef4-9135-838c6066b453-4608x2240.webp`

    const params = new URLSearchParams({
      w: String(width),
      h: String(height),
      crop: [crop.x, crop.y, crop.width, crop.height].join(','),
      hotspot: [hotspot.x, hotspot.y, hotspot.width, hotspot.height].join(','),
    })

    console.log(`${url}?${params.toString()}`)
  }
}

function ImageEditor({ src, $serverMetadata, onCropChange, onHotspotChange }) {

  return (
    derive($serverMetadata, metadata => metadata !== connecting && [
      ImageCropAndHotspot({ src, metadata, onCropChange, onHotspotChange }),
      pre(code(JSON.stringify(metadata, null, 2))),
    ])
  )
}

ImagePreview.style = css`& {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.5rem;

  & > * {
    flex: 1 0 10%;
  }

  .r_3x4 {
    aspect-ratio: 3 / 4;
  }
  .r_1x1 {
    aspect-ratio: 1 / 1;
  }
  .r_16x9 {
    aspect-ratio: 16 / 9;
  }
  .r_2x1 {
    flex-basis: 100%;
    aspect-ratio: 2 / 1;
  }
}`
function ImagePreview({ src, $metadata }) {

  const r_3x4 = useElementSize()
  const r_1x1 = useElementSize()
  const r_16x9 = useElementSize()
  const r_2x1 = useElementSize()

  const $r_3x4Src = useDebounced(useCombined(r_3x4.$size, $metadata)).derive(createSrc)
  const $r_1x1Src = useDebounced(useCombined(r_1x1.$size, $metadata)).derive(createSrc)
  const $r_16x9Src = useDebounced(useCombined(r_16x9.$size, $metadata)).derive(createSrc)
  const $r_2x1Src = useDebounced(useCombined(r_2x1.$size, $metadata)).derive(createSrc)

  return (
    div(
      ImagePreview.style,
      img({ className: 'r_3x4', src: $r_3x4Src, ref: r_3x4.ref }),
      img({ className: 'r_1x1', src: $r_1x1Src, ref: r_1x1.ref }),
      img({ className: 'r_16x9', src: $r_16x9Src, ref: r_16x9.ref }),
      img({ className: 'r_2x1', src: $r_2x1Src, ref: r_2x1.ref }),
    )
  )

  function createSrc([size, { crop, hotspot }]) {
    if (!size) return

    const { width, height } = size

    const params = new URLSearchParams({
      w: String(width), h: String(height),
      ...(crop && { crop: [crop.x, crop.y, crop.width, crop.height].join(',') }),
      ...(hotspot && { hotspot: [hotspot.x, hotspot.y, hotspot.width, hotspot.height].join(',') }),
    })
    const url = `${src}?${params.toString()}`
    console.log('setting source', url)
    return url
  }
}

function useDebounced(signal) {
  const [$debounced, setDebounced] = createSignal(signal.get)

  const debouncedSet = debounce(setDebounced, 200)
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
    patch({ document, path: '', op: 'remove',  })
  }
}

ListItem.style = css`& {
  display: flex;
  text-decoration: none;
  color: inherit;
  justify-content: space-between;
  gap: 1rem;

  &:hover, &.active {
    background-color: lightblue;
  }

  & > button {
    border: none;
  }
}`
function ListItem({ href, title }) {
  const $className = $pathname.derive(pathname => pathname.startsWith(href) ? 'active' : '')
  return Link({ className: $className, href },
    ListItem.style,
    title,
    ButtonChevronRight({ disabled: true })
  )
}

function useDocument({ id, schemaType }) {
  return useEventSourceAsSignal({
    pathname: `${context.apiPath}/documents/${schemaType}/${id}`,
    events: ['document'],
    initialValue: connecting,
  }).derive(x => typeof x === 'symbol' ? x : x && x.data)
}

function useDocuments({ schemaType }) {
  return useEventSourceAsSignal({
    pathname: `${context.apiPath}/documents/${schemaType}`,
    events: ['documents'],
  }).derive(x => x?.data || [])
}

function useImages() {
  return useEventSourceAsSignal({
    pathname: `${context.apiPath}/images`,
    events: ['images'],
  }).derive(x => x?.data || [])
}

/** @returns {Signal<typeof connecting | { width, height, crop?, hotspot? }>} */
function useImageMetadata({ id }) {
  return useEventSourceAsSignal({
    pathname: `${context.apiPath}/images/${id}/metadata`,
    events: ['metadata'],
    initialValue: connecting,
  }).derive(x => typeof x === 'symbol' ? x : x && x.data)
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
