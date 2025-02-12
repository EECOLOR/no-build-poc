import { scrollable } from '#cms/client/ui/scrollable.js'
import { context } from '#cms/client/context.js'
import { connecting, useImageMetadata } from '#cms/client/data.js'
import { createImageSrc } from '#cms/client/form/image/createImgSrc.js'
import { ImageCropAndHotspot } from '#cms/client/form/image/ImageCropAndHotspot.js'
import { debounce } from '#cms/client/machinery/debounce.js'
import { useSubscriptions } from '#cms/client/machinery/signalHooks.js'
import { conditional, useOnDestroy } from '#ui/dynamic.js'
import { useCombined, useElementSize } from '#ui/hooks.js'
import { createSignal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { FlexSectionHorizontal } from '#cms/client/ui/FlexSection.js'

const { img } = tags

ImagePane.style = css`& {
  & > .ImageEditor,
  & > .ImagePreview {
    flex-basis: 50%;
    width: 50%;
  }
}`
export function ImagePane({ id: filename, path }) {
  const src = context.api.images.single({ filename })

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
    FlexSectionHorizontal({ className: 'ImagePane', css: ImagePane.style },
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
    fetch(context.api.images.single.metadata({ filename }), {
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
  align-items: flex-start;
  flex-wrap: wrap;

  & > * { flex-grow: 1; flex-basis:30%; }
  & > :last-child { flex-basis: 100%; }
}`
function ImagePreview({ filename, $metadata }) {

  return (
    scrollable(FlexSectionHorizontal)({ className: 'ImagePreview', css: ImagePreview.style },
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
