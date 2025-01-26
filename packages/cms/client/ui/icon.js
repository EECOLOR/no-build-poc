import { tags, css } from '#ui/tags.js'
import { separatePropsAndChildren } from '#ui/utils.js'

/**
 * @param {string} icon Single line SVG
 * @param {{ rotation?: number }} [props] Rotation in degrees
 * @returns {typeof tags}
 */
export function withIcon(icon, props = {}) {
  return new Proxy(tags, {
    get(target, p) {
      return Icon.bind(null, icon, props, target[p])
    }
  })
}

Icon.style = ({ icon,  rotation = '' }) => css`
  --width: 1.5rem;
  --height: 1.5rem;
  padding: 0.25rem;

  /* lock the width and height independent of the context */
  width: var(--width);
  height: var(--height);
  min-width: var(--width);
  max-width: var(--width);
  min-height: var(--height);
  max-height: var(--height);

  &::before {
    content: '';
    display: block;
    width: 100%;
    height: 100%;

    background-origin: content-box;
    background-image: url('data:image/svg+xml;utf8,${icon}');
    background-position: center;
    background-repeat: no-repeat;

    ${rotation && `transform: rotate(${rotation}deg);`}
  }

  &:disabled {
    opacity: 0.5;
  }
`
/** @returns {(props?: import('#ui/tags.js').Attributes<'div'>) => Tag<'div'>} */
function Icon(icon, { rotation }, element, ...params) {
  const { props, children } = separatePropsAndChildren(params)
  return element(props, Icon.style({ icon, rotation }), ...children)
}

