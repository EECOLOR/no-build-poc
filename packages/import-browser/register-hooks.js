// @ts-ignore - wel, heeft ie wel
import { register } from 'node:module'

register( `./node-hooks/import-browser.js`, { parentURL: import.meta.url } )
