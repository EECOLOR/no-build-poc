import { connecting, useImageMetadata } from '#cms/client/data.js'
import { renderOnValue } from '#cms/client/machinery/renderOnValue.js'
import { useDynamicSignalHook } from '#cms/client/machinery/signalHooks.js'
import { useCombined } from '#ui/hooks.js'
import { css, tags } from '#ui/tags.js'
import { createImageSrc } from '../image/createImgSrc.js'
import { ImageSelector } from '../image/ImageSelector.js'
import { useFieldValue } from './useFieldValue.js'

const { div, img } = tags

ImageField.style = css`& {
  display: flex;
  flex-direction: column;
  gap: var(--default-gap);
}`
export function ImageField({ document, field, $path }) {
  const [$value, setValue] = useFieldValue({
    document, $path, initialValue: null,
    field,
  })

  const $imgSrc = useImgSrc({ $filename: $value, sizeInRem: 25 })

  return (
    div(
      ImageField.style,
      renderOnValue($imgSrc, () => img({ src: $imgSrc })),
      ImageSelector({ onSelect: image => setValue(image.filename) }),
    )
  )
}

function useImgSrc({ $filename, sizeInRem }) {
  const $metadata = useDynamicSignalHook($filename, filename =>
    filename && useImageMetadata({ filename })
  )

  const $imgSrc = useCombined($filename, $metadata)
    .derive(([filename, metadata]) => {
      if (!filename || metadata === connecting)
        return

      const { crop, hotspot } = metadata

      const ratio = crop ? crop.height / crop.width : metadata.height / metadata.width
      const width = Math.round(remToPx(sizeInRem))
      const height = Math.round(ratio * width)

      return createImageSrc(filename, { width, height, crop, hotspot })
    })

  return $imgSrc

  function remToPx(rem) {
    return rem * parseFloat(getComputedStyle(window.document.documentElement).fontSize)
  }
}
