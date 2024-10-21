import { Scrollable } from '#cms/client/buildingBlocks.js'
import { context } from '#cms/client/context.js'
import { useImages } from '#cms/client/data.js'
import { useRef } from '#cms/client/machinery/elementHooks.js'
import { renderOnValue } from '#cms/client/machinery/renderOnValue.js'
import { conditional, derive, loop } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { createImageSrc } from './createImgSrc.js'

const { button, dialog, div, img, pre, input } = tags

const newImage = Symbol('new image')

export function ImageSelector({ onSelect }) {

  const ref = useRef('dialog')

  return (
    div(
      button({ type: 'button', ref, onClick: () => ref.current.showModal() }, 'Select image'),
      ImageSelectorDialog({ ref, onChoose: handleChoose, onCloseClick: handleCloseClick }),
    )
  )

  function handleChoose(image) {
    ref.current.close()
    onSelect(image)
  }

  function handleCloseClick() {
    ref.current.close()
  }
}

ImageSelectorDialog.style = css`& {
  &[open] {
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: end;
  }

  &::backdrop {
    backdrop-filter: blur(0.25rem);
  }
}`
function ImageSelectorDialog({ ref, onChoose, onCloseClick }) {
  return (
    dialog({ ref },
      ImageSelectorDialog.style,
      button({ type: 'button', onClick: onCloseClick }, 'X'),
      ImagesAndDetails({ onChoose }),
    )
  )
}

ImagesAndDetails.style = css`&{
  display: flex;

  & > .Details {
    width: 30%;
  }
}`
function ImagesAndDetails({ onChoose }) {
  const [$selected, setSelected] = createSignal(null)

  return (
    div(
      ImagesAndDetails.style,
      Scrollable({ scrollBarPadding: '0.5rem' },
        Images({
          $selected,
          onSelect: image => setSelected(image),
          onNewClick: () => setSelected(newImage)
        }),
      ),
      renderOnValue($selected, () =>
        Details({ $selected, onSelect: image => setSelected(image), onChoose })
      )
    )
  )
}

function Details({ $selected, onSelect, onChoose }) {
  return (
    div({ className: 'Details' },
      conditional($selected, x => x === newImage,
        () => input({
          type: 'file',
          onChange: handleFileChange,
          accept:'image/jpeg,image/png,image/webp,image/bmp',
        }),
      ),
      conditional($selected, x => x !== newImage,
        () => button({ onClick: () => onChoose($selected.get()) }, 'Select this image'),
      ),
      derive($selected, image => image !== newImage && Image({ image })),
      pre(
        css`& { overflow-x: scroll; }`,
        $selected.derive(x => JSON.stringify(x, null, 2))
      )
    )
  )

  async function handleFileChange(e) {
    /** @type {Array<File>} */
    const [file] = e.currentTarget.files
    if (!file)
      return

    // TODO: prevent large files from being uploaded

    const response = await fetch(`${context.apiPath}/images?${new URLSearchParams({ name: file.name })}`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type,
        'Content-Length': String(file.size),
      },
      body: file,
    }) // TODO: error handling

    if (!response.ok) {
      throw new Error(`Image upload failed [${response.status}]\n${await response.text()}`)
    }

    onSelect(await response.json())
  }
}

Images.style = css`&{
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;

  & > * {
    max-width: 25rem;
    height: 15rem;
  }
}`
function Images({ $selected, onSelect, onNewClick }) {
  const $images = useImages()

  return (
    div(
      Images.style,
      button({ onClick: onNewClick }, 'Upload new image'),
      loop($images, x => x.filename, image =>
        ImageItem({
          image,
          $selected: $selected.derive(selected => selected === image),
          onClick: () => onSelect($selected.get() === image ? null : image),
        })
      )
    )
  )
}

ImageItem.style = css`&{
  & > img {
    border: 1px solid gray;
  }

  &.selected, &:hover {
    & > img {
      border: 1px solid black;
    }
  }
}`
function ImageItem({ image, $selected, onClick }) {
  return (
    div({ className: $selected.derive(x => x ? 'selected' : '' ) },
      ImageItem.style,
      Image({ image, onClick })
    )
  )
}

function Image({ image, ...imgProps }) {
  const { filename, metadata } = image
  return img({ src: createImageSrc(filename, metadata), ...imgProps })
}
