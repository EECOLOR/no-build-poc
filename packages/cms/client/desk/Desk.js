import { css, tags } from '#ui/tags.js'
import { context } from '../context.js'
import { routeMap } from '../routeMap.js'
import { Panes } from './Panes.js'

const { div, hr, a } = tags

Desk.style = css`& {
  display: flex;
  flex-direction: column;
  gap: var(--default-gap);
  padding: var(--default-padding);

  & > .Panes {
    height: 100%;
    flex-grow: 1;
  }
}`
export function Desk({ deskStructure }) {
  return (
    div({ className: 'Desk' },
      Desk.style,
      DeskHeader(),
      hr(),
      Panes({ firstPane: deskStructure.pane }),
    )
  )
}

DeskHeader.style = css`& {
  line-height: 1em;
  display: flex;
  justify-content: space-between;
}`
function DeskHeader() {
  return div({ className: 'DeskHeader' },
    DeskHeader.style,
    'CMS',
    a({ href: context.basePath + routeMap.api.auth.logout() }, 'Logout')
  )
}
