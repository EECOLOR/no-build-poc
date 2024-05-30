import http from 'node:http'
import fs from 'node:fs'
import { IndexHtml } from '/IndexHtml.js'

const server = http.createServer((req, res) => {
  if (req.url.includes('.')) {
    if (req.url.endsWith('.js'))
      return serve(200, 'text/javascript', fs.readFileSync(`.${req.url}`))

    if (req.url.endsWith('.css'))
      return serve(200, 'text/javascript', fs.readFileSync(`./tmp${req.url}.exports`))

    if (req.url.endsWith('.css-real'))
      return serve(200, 'text/css', fs.readFileSync(`./tmp${req.url.replace('-real', '')}.source`, 'utf8'))

    if (!fs.existsSync(`.${req.url}`)) {
      res.writeHead(404)
      res.end()
      return
    }
  }

  serve(200, 'text/html', IndexHtml({ css: getCssLinks() }))

  function serve(status, contentType, content) {
    res.writeHead(status, { 'content-type': contentType })
    res.write(content)
    res.end()
  }
})

server.listen(8000, () => {
  console.log('server started')
})

function getCssLinks() {
  return fs.readdirSync('./tmp')
    .filter(x => x.endsWith('.source'))
    .map(x => {
      const name = x.split('.').slice(0, -1).join('.')
      return `/${name}-real`
    })
}
