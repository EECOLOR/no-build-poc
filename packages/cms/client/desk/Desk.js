import { css, tags } from '#ui/tags.js'
import { context } from '../context.js'
import { routeMap } from '../routeMap.js'
import { FlexSectionBorderedVertical } from '../ui/FlexSection.js'
import { Panes } from './Panes.js'
/** @import { DeskStructure, PaneTypes } from '../cmsConfigTypes.ts' */
/** @import { AuthenticatedInfo } from '../../types.ts' */

const { div, a, span } = tags

/** @type {string | Array<string>} */
Desk.style = css`
  padding: var(--default-padding);

  & > .Panes {
    flex-grow: 1;
    min-height: 0;
  }
`
/** @arg {{ deskStructure: DeskStructure, paneTypes: PaneTypes, auth: AuthenticatedInfo }} props */
export function Desk({ deskStructure, paneTypes, auth }) {
  return (
    FlexSectionBorderedVertical({ className: 'Desk', css: Desk.style },
      DeskHeader({ auth }),
      Panes({ firstPane: deskStructure.pane, paneTypes }),
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
/** @arg {{ auth: AuthenticatedInfo }} props */
function DeskHeader({ auth }) {
  return div({ className: 'DeskHeader', css: DeskHeader.style },
    'CMS',
    span(
      span(auth.user.name),
      span(`(${auth.idProvider})`),
      a({ href: context.basePath + routeMap.api.auth.logout() }, 'Logout')
    )
  )
}
