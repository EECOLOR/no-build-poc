import { css, tags } from '#ui/tags.js'

const { div } = tags

FlexSectionHorizontal.style = css`
  display: flex;
  gap: var(--default-gap);
`
export function FlexSectionHorizontal({ className, css }, ...children) {
  return div({ className, css: [FlexSectionHorizontal.style, css] }, ...children)
}

FlexSectionVertical.style = css`
  display: flex;
  flex-direction: column;
  gap: var(--default-gap);
`
export function FlexSectionVertical({ className, css = undefined }, ...children) {
  return div({ className, css: [FlexSectionVertical.style, css] }, ...children)
}

FlexSectionProperties.style = css`
  display: flex;
  flex-direction: column;
  gap: calc(var(--default-gap) * 2);
`
export function FlexSectionProperties({ className, css = undefined }, ...children) {
  return div({ className, css: [FlexSectionProperties.style, css] }, ...children)
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
  return div({ className, css: [FlexSectionBorderedHorizontal.style, css] }, ...children)
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
  return div({ className, css: [FlexSectionBorderedVertical.style, css] }, ...children)
}
