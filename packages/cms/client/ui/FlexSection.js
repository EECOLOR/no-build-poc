import { combineCss, css, tags } from '#ui/tags.js'

const { div } = tags

FlexSectionHorizontal.style = css`
  display: flex;
  gap: var(--default-gap);
`
export function FlexSectionHorizontal({ className, css }, ...children) {
  return div({ className, css: combineCss(FlexSectionHorizontal.style, css) }, ...children)
}

FlexSectionVertical.style = css`
  display: flex;
  flex-direction: column;
  gap: var(--default-gap);
`
export function FlexSectionVertical({ className }, ...children) {
  return div({ className, css: combineCss(FlexSectionVertical.style, css) }, ...children)
}

FlexSectionProperties.style = css`
  display: flex;
  flex-direction: column;
  gap: calc(var(--default-gap) * 2);
`
export function FlexSectionProperties({ className }, ...children) {
  return div({ className, css: combineCss(FlexSectionProperties.style, css) }, ...children)
}

FlexSectionBorderedHorizontal.style = css`
  display: flex;

  & > *:not(:last-child) {
    margin-right: var(--default-padding);
    padding-right: var(--default-padding);
    border-right: var(--default-border);
  }
`
export function FlexSectionBorderedHorizontal({ className, css }, ...children) {
  return div({ className, css: combineCss(FlexSectionBorderedHorizontal.style, css) }, ...children)
}

FlexSectionBorderedVertical.style = css`
  display: flex;
  flex-direction: column;

  & > *:not(:last-child) {
    margin-bottom: var(--default-padding);
    padding-bottom: var(--default-padding);
    border-bottom: var(--default-border);
  }
`
export function FlexSectionBorderedVertical({ className, css }, ...children) {
  return div({ className, css: combineCss(FlexSectionBorderedVertical.style, css) }, ...children)
}
