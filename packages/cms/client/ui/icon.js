import { Signal } from '#ui/signal.js'
import { tags, css, combineCss } from '#ui/tags.js'
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

Icon.style = ({ icon }) => css`
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

    transform: rotate(var(--rotation, 0));
    transition: transform 200ms;
  }

  &:disabled {
    opacity: 0.5;
  }
`
/**
 * @template {(...args: any[]) => any} T
 * @param {T} element
 * @returns {ReturnType<T>} */
function Icon(icon, { rotation }, element, ...params) {
  const { props, children } = separatePropsAndChildren(params)
  return element(
    {
      ...props,
      style: {
        ...props?.style,
        '--rotation': map(rotation, x => `${x}deg`)
      },
      css: combineCss(Icon.style({ icon }), props?.css)
    },
    ...children
  )
}

function map(x, f) {
  return x instanceof Signal ? x.derive(f) : f(x)
}
