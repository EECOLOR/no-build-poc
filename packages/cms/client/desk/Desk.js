import { css, tags } from '#ui/tags.js'
import { context } from '../context.js'
import { routeMap } from '../routeMap.js'
import { FlexSectionVertical } from '../ui/FlexSection.js'
import { Panes } from './Panes.js'

const { div, a, span } = tags

Desk.style = css`
  padding: var(--default-padding);

  & > .Panes {
    flex-grow: 1;
  }
`
export function Desk({ deskStructure, auth }) {
  return (
    FlexSectionVertical({ className: 'Desk' },
      Desk.style,
      DeskHeader({ auth }),
      Panes({ firstPane: deskStructure.pane }),
    )
  )
}

DeskHeader.style = css`
  line-height: 1em;
  display: flex;
  justify-content: space-between;

  & > span {
    display: flex;
    gap: 1em;
  }
`
function DeskHeader({ auth }) {
  return div({ className: 'DeskHeader' },
    DeskHeader.style,
    'CMS',
    span(
      span(auth.user.name),
      span(`(${auth.idProvider})`),
      a({ href: context.basePath + routeMap.api.auth.logout() }, 'Logout')
    )
  )
}
