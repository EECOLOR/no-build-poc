import { connecting, useImageMetadata } from '#cms/client/data.js'
import { renderOnValue } from '#cms/client/machinery/renderOnValue.js'
import { useDynamicSignalHook } from '#cms/client/machinery/signalHooks.js'
import { Button } from '#cms/client/ui/Button.js'
import { FlexSectionVertical } from '#cms/client/ui/FlexSection.js'
import { useCombined } from '#ui/hooks.js'
import { Signal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { createImageSrc } from '../image/createImgSrc.js'
import { ImageSelector } from '../image/ImageSelector.js'
import { useFieldValue } from './useFieldValue.js'
/** @import { DocumentContainer, DocumentPath } from '#cms/types.ts' */
/** @import { DocumentSchema } from '#cms/client/cmsConfigTypes.ts' */

const { img } = tags

/** @typedef {{}} ImageFieldConfig */

ImageField.style = css`
  align-items: start;
`
/**
 * @arg {{
 *   document: DocumentContainer,
 *   field: DocumentSchema.Field<'image'>,
 *   $path: Signal<DocumentPath>,
 * }} props
 */
export function ImageField({ document, field, $path }) {
  const [$value, setValue] = useFieldValue({
    document, $path, initialValue: null,
    field,
  })

  const $imgSrc = useImgSrc({ $filename: $value, sizeInRem: 25 })

  return (
    FlexSectionVertical({ className: 'ImageField', css: ImageField.style },
      renderOnValue($imgSrc, () => img({ src: $imgSrc })),
      renderOnValue($imgSrc, () => Button({ label: 'Clear image', onClick: () => setValue(null) })),
      ImageSelector({ onSelect: image => setValue(image.filename) }),
    )
  )
}

/** @arg {{ $filename: Signal<string>, sizeInRem: number }} props */
function useImgSrc({ $filename, sizeInRem }) {
  const $metadata = useDynamicSignalHook($filename, filename =>
    filename && useImageMetadata({ filename })
  )

  const $imgSrc = useCombined($filename, $metadata)
    .derive(([filename, metadata]) => {
      if (!filename || metadata === connecting || !metadata)
        return

      const { crop, hotspot } = metadata

      const ratio = crop ? crop.height / crop.width : metadata.height / metadata.width
      const width = Math.round(remToPx(sizeInRem))
      const height = Math.round(ratio * width)

      return createImageSrc(filename, { width, height, crop, hotspot })
    })

  return $imgSrc

  /** @arg {number} rem */
  function remToPx(rem) {
    return rem * parseFloat(getComputedStyle(window.document.documentElement).fontSize)
  }
}
