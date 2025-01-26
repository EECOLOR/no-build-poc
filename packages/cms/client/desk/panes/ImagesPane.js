import { ListSignal } from '#cms/client/ui/List.js'
import { context } from '#cms/client/context.js'
import { useImages } from '#cms/client/data.js'
import { css, tags } from '#ui/tags.js'
import { ListItem } from './list/ListItem.js'

const { div, img } = tags

ImagesPane.style = css`& {
  max-width: 10rem;
  min-width: 10rem;
}`
export function ImagesPane({ path }) {
  const $images = useImages()

  return (
    ListSignal(
      {
        className: 'ImagesPane',
        signal: $images,
        getKey: image => image.filename,
        renderItem: ($image, key) => ImageItem({ filename: key, path })
      },
      ImagesPane.style,
    )
  )
}

function ImageItem({ filename, path }) {
  return (
    ListItem({
      href: [context.basePath, ...path, filename].join('/'),
      title: div(
        css`& {
          max-height: 5rem;
          width: 5rem;
          padding: calc(var(--default-padding * 2));

          & > img {
            max-height: 100%;
          }
        }`,
        img({ src: context.api.images.single({ filename }) }),
      )
     })
  )
}
