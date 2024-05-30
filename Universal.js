import { containerMarker } from '/containerMarker.js'
import { tags } from '/tags.js'

const { script } = tags

export function Universal(Component, props) {
  return [
    comment('start'),
    comment(JSON.stringify({
      componentName: Component.name, // We probably need an import map or something
      props, // Should be 'safe encode'
    })),
    Component(props),
    comment('end'),
    script(`
      var d=document,s=d.currentScript,p=s.parentNode;
      ${/* set marker on container so we can retrieve nodes that contain components */''}
      p.setAttribute('${containerMarker}','');
      ${/* remove the script tag itself */''}
      p.removeChild(s);
    `.replace(/(^\s*|\n)/gm, ''))
  ]
}

function comment(content) {
  return `<!--${content}-->`
}
