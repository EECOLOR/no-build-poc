import { Button, ButtonClose } from '#cms/client/ui/Button.js'
import { context } from '#cms/client/context.js'
import { useImages } from '#cms/client/data.js'
import { plus } from '#cms/client/ui/icons.js'
import { renderOnValue } from '#cms/client/machinery/renderOnValue.js'
import { withIcon } from '#cms/client/ui/icon.js'
import { conditional, derive, loop } from '#ui/dynamic.js'
import { createSignal, Signal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { createImageSrc } from './createImgSrc.js'
import { scrollable } from '#cms/client/ui/scrollable.js'
import { FlexSectionHorizontal, FlexSectionVertical } from '#cms/client/ui/FlexSection.js'
import { useController } from '#cms/client/machinery/useController.js'
import { Dialog } from '#cms/client/ui/Dialog.js'
import { asConst } from '#cms/client/machinery/typeHelpers.js'

/** @import { Image } from '#cms/types.ts' */
/** @import { ChangeEventHandler } from 'react' */
/** @import { Attributes } from '#ui/tags.js' */

/** @typedef {(image: Image) => void} ImageHandler */
/** @typedef {() => void} Handler */
/** @typedef {typeof newImage} NewImageSymbol */

const { div, img, input } = tags

const newImage = Symbol('new image')

/** @arg {{ onSelect: ImageHandler }} props */
export function ImageSelector({ onSelect }) {
  const controller = useController(Dialog.controller)

  return (
    div(
      Button({ label: 'Select image', onClick: () => controller.open() }),
      Dialog({ controller },
        ImageSelectorDialogContent({ onChoose: handleChoose, onCloseClick: handleCloseClick })
      ),
    )
  )

  /** @arg {Image} image */
  function handleChoose(image) {
    controller.close()
    onSelect(image)
  }

  function handleCloseClick() {
    controller.close()
  }
}

ImageSelectorDialogContent.style = css`
  align-items: end;
`
/** @arg {{ onChoose: ImageHandler, onCloseClick: Handler }} props */
function ImageSelectorDialogContent({ onChoose, onCloseClick }) {
  return FlexSectionVertical({ className: 'ImageSelectorDialogContent', css: ImageSelectorDialogContent.style },
    ButtonClose({ onClick: onCloseClick }),
    ImagesAndDetails({ onChoose }),
  )
}

ImagesAndDetails.style = css`
  display: flex;
  min-height: 0;

  & > * {
    height: 100%;
  }

  & > .Details {
    min-width: 30%;
    width: 30%;
  }
`
/** @arg {{ onChoose: ImageHandler }} props */
function ImagesAndDetails({ onChoose }) {
  const [$selected, setSelected] = createSignal(/** @type {Image | NewImageSymbol} */ (null))

  return (
    div({ className: 'ImagesAndDetails', css: ImagesAndDetails.style },
      Images({
        $selected,
        onSelect: setSelected,
        onNewClick: () => setSelected(newImage)
      }),
      renderOnValue($selected, () =>
        Details({ $selected, onSelect: image => setSelected(image), onChoose })
      )
    )
  )
}

Details.style = css`
  align-items: center;
  padding: var(--default-padding);

  & > * {
    flex-shrink: 0;
  }

  & > .Image {
    align-self: center;
  }
`
/**
 * @arg {{
 *   $selected: Signal<Image | NewImageSymbol>,
 *   onSelect: ImageHandler,
 *   onChoose: ImageHandler
 * }} props
 */
function Details({ $selected, onSelect, onChoose }) {
  return (
    scrollable(FlexSectionVertical)({ className: 'Details', css: Details.style },
      conditional($selected, x => x === newImage,
        _ => SelectFile({ onChange: handleFileChange }),
      ),
      derive($selected, image => image !== newImage && asConst([
        Image({ image }),
        sizeString(image),
        Button({ label: 'Select this image', onClick: () => onChoose(image) }),
      ])),
    )
  )

  /** @arg {Image} image */
  function sizeString({ metadata }) {
    const { width, height } = metadata.crop || metadata
    return `${width} x ${height}`
  }

  /** @arg {Parameters<ChangeEventHandler<HTMLInputElement>>[0]} e */
  async function handleFileChange(e) {
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

/** @arg {{ onChange: ChangeEventHandler<HTMLInputElement> }} props */
function SelectFile({ onChange }) {
  return (
    input({
      type: 'file',
      onChange,
      accept:'image/jpeg,image/png,image/webp,image/bmp',
    })
  )
}

Images.style = css`
  flex-wrap: wrap;
  align-items: center;

  & > * {
    max-width: 25rem;
    height: 15rem;
  }
`
/** @arg {{ $selected: Signal<Image | NewImageSymbol>, onSelect: ImageHandler, onNewClick: Handler }} props */
function Images({ $selected, onSelect, onNewClick }) {
  const $images = useImages()

  return (
    scrollable(FlexSectionHorizontal)({ className: 'Images', css: Images.style },
      Button({
        label: AddLabel(),
        onClick: onNewClick
      }),
      loop($images, x => x.filename, $image =>
        derive($image, image =>
          ImageItem({
            image,
            $selected: $selected.derive(selected => selected === image),
            onClick: () => onSelect($selected.get() === image ? null : image),
          })
        )
      )
    )
  )
}

AddLabel.styles = css`
  justify-content: center;
  align-items: center;
`
function AddLabel() {
  return FlexSectionVertical({ className: 'AddLabel', css: AddLabel.styles },
    withIcon(plus).span(),
    'Upload new image'
  )
}

ImageItem.style = css`
  & > img {
    border: 1px solid gray;
  }

  &.selected, &:hover {
    & > img {
      border: 1px solid black;
    }
  }
`
/** @arg {{ image: Image, $selected: Signal<boolean>, onClick: Handler }} props */
function ImageItem({ image, $selected, onClick }) {
  return (
    div({ className: $selected.derive(x => x ? 'selected' : '' ), css: ImageItem.style },
      Image({ image, onClick })
    )
  )
}

/** @arg {{ image: Image } & Attributes<'img'>} props */
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
