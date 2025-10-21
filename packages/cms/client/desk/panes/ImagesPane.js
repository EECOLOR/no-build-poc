import { ListSignal } from '#cms/client/ui/List.js'
import { context } from '#cms/client/context.js'
import { useImages } from '#cms/client/data.js'
import { css, tags } from '#ui/tags.js'
import { ListItem } from './list/ListItem.js'
import { pane } from '#cms/client/cmsConfig.js'
/** @import { DeskStructure } from '../../cmsConfigTypes.ts' */
/** @import { PanePath } from '../../../types.ts' */

const { div, img } = tags

/**
 * @typedef {{}} ImagesPaneConfig
 */

/** @type {DeskStructure.PaneResolver<ImagesPaneConfig>} */
export function resolveImagesPane({ config, context }) {
  const child = pane('image', { id: context.nextPathSegment })
  return { child }
}

/** @type {DeskStructure.PaneRenderer<ImagesPaneConfig>} */
export function renderImagesPane({ pane, path }) {
  return ImagesPane({ path })
}

ImagesPane.style = css`
  max-width: 10rem;
  min-width: 10rem;
`
/** @arg {{ path: PanePath }} props */
export function ImagesPane({ path }) {
  const $images = useImages()

  return (
    ListSignal(
      {
        className: 'ImagesPane',
        css: ImagesPane.style,
        signal: $images,
        getKey: image => image.filename,
        renderItem: ($image, key) => ImageItem({ filename: key, path })
      },
    )
  )
}

/** @arg {{ filename: string, path: PanePath }} props */
function ImageItem({ filename, path }) {
  return (
    ListItem({
      href: [context.basePath, ...path, filename].join('/'),
      title: div(
        {
          css: css`
            max-height: 5rem;
            width: 5rem;
            padding: calc(var(--default-padding * 2));

            & > img {
              max-height: 100%;
            }
          `
        },
        img({ src: context.api.images.single({ filename }) }),
      )
     })
  )
}
