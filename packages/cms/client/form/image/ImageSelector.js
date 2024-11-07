import { Button, ButtonClose, IconAdd, scrollable } from '#cms/client/buildingBlocks.js'
import { context } from '#cms/client/context.js'
import { useImages } from '#cms/client/data.js'
import { renderOnValue } from '#cms/client/machinery/renderOnValue.js'
import { conditional, derive, loop } from '#ui/dynamic.js'
import { useRef } from '#ui/hooks.js'
import { createSignal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { createImageSrc } from './createImgSrc.js'

const { dialog, div, img, input } = tags

const newImage = Symbol('new image')

export function ImageSelector({ onSelect }) {
  const ref = useRef('dialog')

  return (
    div(
      Button({ label: 'Select image', ref, onClick: () => ref.current.showModal() }),
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
    padding: var(--default-padding);
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: end;
    gap: var(--default-gap);
    box-shadow: 4px 4px 8px rgb(0 0 0 / 50%);
    height: 100%;
  }

  &::backdrop {
    backdrop-filter: blur(0.25rem);
  }
}`
function ImageSelectorDialog({ ref, onChoose, onCloseClick }) {
  return (
    dialog({ ref },
      ImageSelectorDialog.style,
      ButtonClose({ onClick: onCloseClick }),
      ImagesAndDetails({ onChoose }),
    )
  )
}

ImagesAndDetails.style = css`&{
  display: flex;
  min-height: 0;

  & > * {
    height: 100%;
  }

  & > .Details {
    min-width: 30%;
    width: 30%;
  }
}`
function ImagesAndDetails({ onChoose }) {
  const [$selected, setSelected] = createSignal(null)

  return (
    div({ className: 'ImagesAndDetails '},
      ImagesAndDetails.style,
      Images({
        $selected,
        onSelect: image => setSelected(image),
        onNewClick: () => setSelected(newImage)
      }),
      renderOnValue($selected, () =>
        Details({ $selected, onSelect: image => setSelected(image), onChoose })
      )
    )
  )
}

Details.style = css`& {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--default-gap);
  padding: var(--default-padding);

  & > * {
    flex-shrink: 0;
  }

  & > .Image {
    align-self: center;
  }
}`
function Details({ $selected, onSelect, onChoose }) {
  return (
    scrollable.div({ className: 'Details' },
      Details.style,
      conditional($selected, x => x === newImage,
        () => SelectFile({ onChange: handleFileChange }),
      ),
      derive($selected, image => image !== newImage && [
        Image({ image }),
        $selected.derive(sizeString),
        Button({ label: 'Select this image', onClick: () => onChoose($selected.get()) }),
      ]),
    )
  )

  function sizeString({ metadata }) {
    const { width, height } = metadata.crop || metadata
    return `${width} x ${height}`
  }

  async function handleFileChange(e) {
    /** @type {Array<File>} */
    const [file] = e.currentTarget.files
    if (!file)
      return

    // TODO: prevent large files from being uploaded

    const response = await fetch(`${context.api.images()}?${new URLSearchParams({ name: file.name })}`, {
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

function SelectFile({ onChange }) {
  return (
    input({
      type: 'file',
      onChange,
      accept:'image/jpeg,image/png,image/webp,image/bmp',
    })
  )
}

Images.style = css`& {
  display: flex;
  flex-wrap: wrap;
  gap: var(--default-gap);
  align-items: center;

  & > * {
    max-width: 25rem;
    height: 15rem;
  }
}`
function Images({ $selected, onSelect, onNewClick }) {
  const $images = useImages()

  return (
    scrollable.div(
      Images.style,
      Button({
        label: AddLabel(),
        onClick: onNewClick
      }),
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

AddLabel.styles = css`& {
  display: flex;
  flex-direction: column;
  gap: var(--default-gap);
  justify-content: center;
  align-items: center;
}`
function AddLabel() {
  return div(
    AddLabel.styles,
    IconAdd(),
    'Upload new image'
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
  const { crop, hotspot } = metadata
  const { width, height } = crop || metadata
  return img({
    className: 'Image',
    loading: 'lazy',
    src: createImageSrc(filename, { width, height, crop, hotspot }),
    ...imgProps
  })
}
