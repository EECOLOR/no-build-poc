import { conditional, derive, loop } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { ButtonAdd, ButtonChevronLeft, ButtonChevronRight, ButtonDelete, Link, List, Scrollable } from '../buildingBlocks.js'
import { context, getSchema } from '../context.js'
import { DocumentForm, patch } from '../form/DocumentForm.js'
import { DocumentHistory } from '../history/DocumentHistory.js'
import { $pathname, pushState } from '../machinery/history.js'
import { renderOnValue } from '../machinery/renderOnValue.js'
import { useCombined } from '../machinery/useCombined.js'
import { useDragableRectangle, useDraggableEllipse } from '../machinery/useDrag.js'
import { useEventSourceAsSignal } from '../machinery/useEventSourceAsSignal.js'
import { useElementSize } from '../machinery/useHasScrollbar.js'

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

  & > * {
    height: 100%;
  }
}`
function ImagePane({ id, path }) {
  const $metadata = useImageMetadata({ id })
  return (
    div(
      ImagePane.style,
      Scrollable({ scrollBarPadding: '0.5rem' },
        div(
          css`&{ width: 50%; }`,
          derive($metadata, metadata => metadata !== connecting && [
            HotspotAndCrop({ id, metadata }),
            pre(code(JSON.stringify(metadata, null, 2))),
          ])
        )
      )
    )
  )
}

HotspotAndCrop.style = css`& {
  display: grid;
  grid-template-columns: 1fr;
  padding: 10px;

  & > * {
    grid-row-start: 1;
    grid-column-start: 1;

    width: 100%;
    height: 100%;

    position: relative;
  }
}`
function HotspotAndCrop({ id, metadata }) {
  const imageSrc = `${context.apiPath}/images/${id}`
  const crop = null // { x: 20, y: 40, width: 120, height: 100 }
  const hotspot = null // { x: 40, y: 60, width: 80, height: 60 }

  // const debounced = debounce(onDragEnd, 200)
  // useOnDestroy($position.subscribe(debounced))

  const { ref, $size } = useElementSize()

  return (
    div(
      HotspotAndCrop.style,
      img({ ref, src: imageSrc }),
      derive($size, size =>
        size && HotspotAndCropOverlay({
          imageSrc,
          displaySize: size,
          crop: crop || addPosition(size),
          hotspot: hotspot || crop || addPosition(size),
        })
      )
    )
  )

  function addPosition(size) {
    return { x: 0, y: 0, ...size }
  }

  // function onDragEnd() {
  //   console.log('done', $position.get())
  // }
}

function HotspotAndCropOverlay({ imageSrc, crop, hotspot, displaySize }) {
  const { corners, rectangle, $inset, $area } = useDragableRectangle(displaySize, crop)

  return [
    CropOverlay({ imageSrc, corners, rectangle, $inset }),
    HotspotOverlay({ imageSrc, hotspot, $bounds: $area }),
  ]
}

function HotspotOverlay({ imageSrc, $bounds, hotspot }) {

  const { center, handle, $ellipse } = useDraggableEllipse({ $bounds, initialEllipse: hotspot })

  return [
    Shadow(),
    HotspotImage({ imageSrc, $ellipse }),
    HotspotEllipse({ center, handle, $ellipse }),
  ]
}

function HotspotImage({ imageSrc, $ellipse }) {
  const $clipPath = ellipseAsClipPath($ellipse)

  return img({ src: imageSrc, style: { clipPath: $clipPath } })
}

function ellipseAsClipPath($ellipse) {
  return $ellipse.derive(({ xAxis, yAxis, centerX, centerY }) =>
    `ellipse(${xAxis}px ${yAxis}px at ${centerX}px ${centerY}px)`
  )
}

HotspotEllipse.style = css`& {
  pointer-events: none;
  position: relative;

  & > * {
    pointer-events: auto;
    position: absolute;
  }

  & > * { cursor: move; }
  & > .handle { cursor: nwse-resize; }
}`
function HotspotEllipse({ center, handle, $ellipse }) {
  return (
    div(
      HotspotEllipse.style,
      HotspotArea({ onMouseDown: center.handleMouseDown, $ellipse }),
      Handle({ handle })
    )
  )
}

HotspotArea.style = css`& {
  overflow: visible;
  width: 0;
  height: 0;

  &::after {
    content: '';
    display: block;
    width: var(--width);
    height: var(--height);
    transform: translate(-50%, -50%);
    clip-path: var(--clipPath);
  }
}`
function HotspotArea({ onMouseDown, $ellipse }) {
  const $localEllipse = $ellipse.derive(({ xAxis, yAxis }) =>
    ({ centerX: xAxis, centerY: yAxis, xAxis, yAxis })
  )
  const $clipPath = ellipseAsClipPath($localEllipse)

  const style = {
    top: $ellipse.derive(x => x.centerY),
    left: $ellipse.derive(x => x.centerX),
    '--width': $ellipse.derive(x => `${x.xAxis * 2}px`),
    '--height': $ellipse.derive(x => `${x.yAxis * 2}px`),
    '--clipPath': $clipPath,
  }

  return div({ className: 'HotspotArea', onMouseDown, style }, HotspotArea.style)
}

function CropOverlay({ imageSrc, corners, rectangle, $inset }) {
  return [
    Shadow(),
    CropImage({ imageSrc, $inset }),
    CropRectangle({ corners, rectangle, $inset })
  ]
}

function CropImage({ imageSrc, $inset }) {
  const $clipPath = $inset.derive(x => `inset(${x.top}px ${x.right}px ${x.bottom}px ${x.left}px)`)

  return img({ src: imageSrc, style: { clipPath: $clipPath } })
}

function Shadow() {
  return div(css`& { background-color: rgb(0 0 0 / 40%); pointer-events: none; }`)
}

CropRectangle.style = css`& {
  position: relative;
  pointer-events: none;

  & > * {
    position: absolute;
    pointer-events: auto;
  }

  & > * { cursor: move; }
  & > .tl, & > .br { cursor: nwse-resize; }
  & > .tr, & > .bl { cursor: nesw-resize; }
}`
function CropRectangle({ corners, rectangle, $inset }) {
  return (
    div(
      CropRectangle.style,
      CropArea({ onMouseDown: rectangle.handleMouseDown, $inset }),
      corners.map(handle => Handle({ handle })),
    )
  )
}

function CropArea({ onMouseDown, $inset }) {
  const style = {
    top: $inset.derive(x => x.top),
    left: $inset.derive(x => x.left),
    bottom: $inset.derive(x => x.bottom),
    right: $inset.derive(x => x.right),
  }

  return div({ className: 'CropArea', onMouseDown, style })
}

Handle.style = css`& {
  will-change: transform;

  width: 0;
  height: 0;
  overflow: visible;

  --corner-size: 20px;
  --min-corner-size: calc(-1 * var(--corner-size));

  &::after {
    content: '';
    display: block;
    width: var(--corner-size);
    height: var(--corner-size);
    transform: translate(-50%, -50%);
    background-color: turquoise;
  }
}`
function Handle({ handle }) {
  const { id, handleMouseDown, $translate, $position } = handle
  const [handleX, handleY] = $position.get()
  const $transformStyle = $translate.derive(([x, y]) => `translate(${x}px,${y}px)`)
  return (
    div(
      {
        onMouseDown: handleMouseDown,
        className: id,
        style: { transform: $transformStyle, left: handleX, top: handleY }
      },
      Handle.style
    )
  )
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
