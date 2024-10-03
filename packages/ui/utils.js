export function separatePropsAndChildren(params) {
  const [propsOrChild, ...children] = params
  const hasProps = propsOrChild?.constructor === Object

  return {
    props: hasProps ? propsOrChild: null,
    children: hasProps ? children : params
  }
}