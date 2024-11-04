import { asRouteChain, asRouteMap, match, routeMapSymbol, routeSymbol } from './index.js'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

describe('asRouteMap', () => {

  test('routeMapSymbol', () => {
    expect(asRouteMap({})[routeMapSymbol]).toEqual({
      children: [],
      config: { localeParamName: 'language', trailingSlash: true }
    })
  })

  test('routeMapSymbol children', () => {
    const { children } = asRouteMap({ x: 'y' })[routeMapSymbol]

    expect(children[0]).toBeDefined()
    expect(children[0].path).toBe('y')
  })

  describe('string route conversion', () => {
    test('structure', () => {
      const routeMap = asRouteMap({ x: 'y' })

      expect(routeMap.x).toBeDefined()
      const { x } = routeMap
      expect(x.path).toBe('y')
      expect(x.data).toBe(undefined)
      expect(x[routeSymbol].parent).toBe(null)
    })

    test('static', () => {
      const { x } = asRouteMap({ x: 'y' })
      expect(x.path).toBe('y')
      expect(x()).toBe('/y/')
    })

    test('dynamic', () => {
      const { x } = asRouteMap({ x: 'a/:x/b' })
      expect(x.path).toBe('a/:x/b')
      expect(x({ x: 'y' })).toBe('/a/y/b/')
    })
  })

  describe('object route conversion', () => {
    describe('structure', () => {
      test('path only', () => {
        const routeMap = asRouteMap({ x: { path: 'y' } })

        expect(routeMap.x).toBeDefined()
        const { x } = routeMap
        expect(x.path).toBe('y')
      })
      test('path & data', () => {
        const data = { x: Symbol('data') }
        const { x } = asRouteMap({ x: { path: 'y', data } })

        expect(x.path).toBe('y')
        expect(x.data).toBe(data)
      })
      test('localized paths error', () => {
        const map = asRouteMap({
          x: {
            path: ':language',
            y: { path: { en: 'y', nl: 'z'} }
          }
        })
        expect(() => map.x.y({ language: 'de' })).toThrowError(/locale/)
      })
      test('localized paths', () => {
        const path = { en: 'y', nl: 'z'}
        const map = asRouteMap({
          x: {
            path: ':language',
            y: { path }
          }
        })

        expect(map.x.path).toBe(':language')
        expect(map.x.y.path).toBe(path)
      })
      test('localized paths & data', () => {
        const path = { en: 'y', nl: 'z'}
        const data = { x: Symbol('data') }
        const map = asRouteMap({
          x: {
            path: ':language',
            y: { path, data }
          }
        })
        expect(map.x.y.path).toBe(path)
        expect(map.x.y.data).toBe(data)
      })
      test('allow empty path', () => {
        expect(() => asRouteMap({ x: '' })).not.toThrowError()
      })
      test('error on incorrect structure', () => {
        expect(() => asRouteMap({ x: { en: 'a', nl: 'b' } })).toThrowError(/path/)
        expect(() => asRouteMap({ x: true })).toThrowError(/path/)
        expect(() => asRouteMap({ x: 0 })).toThrowError(/path/)
        expect(() => asRouteMap({ x: 1 })).toThrowError(/path/)
        expect(() => asRouteMap({ x: false })).toThrowError(/path/)
        expect(() => asRouteMap({ x: null })).toThrowError(/path/)
      })
      test('language', () => {
        const map = asRouteMap({
          language: {
            path: ':language',

            a: { path: { nl: 'a', en: 'b' } },
          },
        })

        expect(match(map, 'nl/a').route).toBe(map.language.a)
        expect(map.language.a({ language: 'nl' })).toBe('/nl/a/')
        expect(match(map, 'en/a')).toBe(null)

        expect(match(map, 'en/b').route).toBe(map.language.a)
        expect(map.language.a({ language: 'en' })).toBe('/en/b/')
        expect(match(map, 'nl/b')).toBe(null)
      })
      test('language - custom language param name', () => {
        const map = asRouteMap(
          {
            language: {
              path: ':locale',

              a: { path: { nl: 'a', en: 'b' } }
            },
            noLanguage: {
              path: 'c',

              d: { path: { nl: 'e', en: 'f' } }
            },
          },
          {
            localeParamName: 'locale',
          }
        )

        expect(match(map, 'nl/a').route).toBe(map.language.a)
        expect(map.language.a({ locale: 'nl' })).toBe('/nl/a/')
        expect(match(map, 'en/a')).toBe(null)

        expect(match(map, 'en/b').route).toBe(map.language.a)
        expect(map.language.a({ locale: 'en' })).toBe('/en/b/')
        expect(match(map, 'nl/b')).toBe(null)

        expect(map.noLanguage.d({ locale: 'en' })).toBe('/c/f/')
      })
    })
    describe('reverse routing', () => {
      test('path static', () => {
        const { x } = asRouteMap({ x: { path: 'y' } })
        expect(x()).toBe('/y/')
      })
      test('path dynamic', () => {
        const map = asRouteMap({ x: { path: 'a/:y/b' } })
        expect(map.x({ y: 'z' })).toBe('/a/z/b/')
      })
      test('localized path static', () => {
        const path = { en: 'a', nl: 'b' }
        const { x } = asRouteMap({ x: { path } })
        expect(x({ language: 'en' })).toEqual('/a/')
        expect(x({ language: 'nl' })).toEqual('/b/')
      })
      test('localized path dynamic', () => {
        const map = asRouteMap({ x: { path: { en: 'x/:a/y', nl: 'a/:b/b' }
       } })
        const { x } = map
        expect(x({ language: 'en', a: 'c', b: 'd' })).toEqual('/x/c/y/')
        expect(x({ language: 'nl', a: 'c', b: 'd' })).toEqual('/a/d/b/')
      })
      test('automatic language selection', () => {
        const { x } = asRouteMap({
          x: {
            path: ':language',

            y: { path: { en: 'a', nl: 'b' } }
          }
        })
        expect(x({ language: 'en' })).toBe('/en/')
        expect(x.y({ language: 'en' })).toBe('/en/a/')
        expect(x({ language: 'nl' })).toBe('/nl/')
        expect(x.y({ language: 'nl' })).toBe('/nl/b/')
        expect(x({ language: 'de' })).toBe('/de/')
        expect(() => x.y({ language: 'de' })).toThrowError(/locale/)
      })
    })
    describe('reverse routing without trailing slash', () => {
      test('path static', () => {
        const { x } = asRouteMap({ x: { path: 'y' } }, { trailingSlash: false })
        expect(x()).toBe('/y')
      })
      test('path dynamic', () => {
        const map = asRouteMap({ x: { path: 'a/:y/b' } }, { trailingSlash: false })
        expect(map.x({ y: 'z' })).toBe('/a/z/b')
      })
      test('localized path static', () => {
        const path = { en: 'a', nl: 'b' }
        const { x } = asRouteMap({ x: { path } }, { trailingSlash: false })
        expect(x({ language: 'en' })).toEqual('/a')
        expect(x({ language: 'nl' })).toEqual('/b')
      })
      test('localized path dynamic', () => {
        const map = asRouteMap(
          { x: { path: { en: 'x/:a/y', nl: 'a/:b/b' } } },
          { trailingSlash: false }
        )
        const { x } = map
        expect(x({ language: 'en', a: 'c', b: 'd' })).toEqual('/x/c/y')
        expect(x({ language: 'nl', a: 'c', b: 'd' })).toEqual('/a/d/b')
      })
      test('automatic language selection', () => {
        const { x } = asRouteMap({
          x: {
            path: ':language',

            y: { path: { en: 'a', nl: 'b' } }
          }
        }, { trailingSlash: false })
        expect(x({ language: 'en' })).toBe('/en')
        expect(x.y({ language: 'en' })).toBe('/en/a')
        expect(x({ language: 'nl' })).toBe('/nl')
        expect(x.y({ language: 'nl' })).toBe('/nl/b')
        expect(x({ language: 'de' })).toBe('/de')
        expect(() => x.y({ language: 'de' })).toThrowError(/locale/)
      })
    })
    describe('child routes', () => {
      test('minimal', () => {
        const { x } = asRouteMap({ x: { path: 'y', child: 'z' } })
        expect(x.child).toBeDefined()
        expect(x.child.path).toBe('z')
        expect(x()).toBe('/y/')
        expect(x.child()).toBe('/y/z/')
      })
      test('minimal without trailing slash', () => {
        const { x } = asRouteMap({ x: { path: 'y', child: 'z' } }, { trailingSlash: false })
        expect(x()).toBe('/y')
        expect(x.child()).toBe('/y/z')
      })
      test('nested', () => {
        const { x } = asRouteMap({ x: { path: 'a', child: { path: 'b', nested: 'c' } } })
        expect(x.child.nested).toBeDefined()
        expect(x()).toBe('/a/')
        expect(x.child()).toBe('/a/b/')
        expect(x.child.nested()).toBe('/a/b/c/')
      })
      test('nested without trailing slash', () => {
        const { x } = asRouteMap({ x: { path: 'a', child: { path: 'b', nested: 'c' } } }, { trailingSlash: false })
        expect(x()).toBe('/a')
        expect(x.child()).toBe('/a/b')
        expect(x.child.nested()).toBe('/a/b/c')
      })
      test('localized leaf', () => {
        const { x } = asRouteMap({ x: {
          path: 'a',
          child: {
            path: 'b',
            nested: { path: { en: 'c', nl: 'd' } },
          }
        }})
        expect(x()).toBe('/a/')
        expect(x.child()).toBe('/a/b/')
        expect(x.child.nested({ language: 'en' })).toBe('/a/b/c/')
        expect(x.child.nested({ language: 'nl' })).toBe('/a/b/d/')
        expect(() => x.child.nested({ language: 'de' })).toThrowError(/locale/)
      })
      test('localized leaf without trailing slash', () => {
        const { x } = asRouteMap(
          {
              x: {
              path: 'a',
              child: {
                path: 'b',
                nested: { path: { en: 'c', nl: 'd' } },
              }
            }
          },
          { trailingSlash: false }
        )
        expect(x()).toBe('/a')
        expect(x.child()).toBe('/a/b')
        expect(x.child.nested({ language: 'en' })).toBe('/a/b/c')
        expect(x.child.nested({ language: 'nl' })).toBe('/a/b/d')
        expect(() => x.child.nested({ language: 'de' })).toThrowError(/locale/)
      })
      test('localized branch', () => {
        const map = {
          path: 'a',
          child: {
            path: { en: 'b', nl: 'c' },
            nested: 'd',
          }
        }
        const { x } = asRouteMap({ x: map })
        expect(x()).toBe('/a/')
        expect(x.child({ language: 'en' })).toBe('/a/b/')
        expect(x.child.nested({ language: 'en' })).toBe('/a/b/d/')
        expect(x.child({ language: 'nl' })).toBe('/a/c/')
        expect(x.child.nested({ language: 'nl' })).toBe('/a/c/d/')
        expect(() => x.child.nested({ language: 'de' })).toThrowError(/locale/)
      })
      test('localized branch without trailing slash', () => {
        const map = {
          path: 'a',
          child: {
            path: { en: 'b', nl: 'c' },
            nested: 'd',
          }
        }
        const { x } = asRouteMap({ x: map }, { trailingSlash: false })
        expect(x()).toBe('/a')
        expect(x.child({ language: 'en' })).toBe('/a/b')
        expect(x.child.nested({ language: 'en' })).toBe('/a/b/d')
        expect(x.child({ language: 'nl' })).toBe('/a/c')
        expect(x.child.nested({ language: 'nl' })).toBe('/a/c/d')
        expect(() => x.child.nested({ language: 'de' })).toThrowError(/locale/)
      })
      test('localized root', () => {
        const { x } = asRouteMap({ x: {
          path: { en: 'a', nl: 'b' },
          child: {
            path: 'c',
            nested: 'd',
          }
        } })
        expect(x({ language: 'en' })).toBe('/a/')
        expect(x.child({ language: 'en' })).toBe('/a/c/')
        expect(x.child.nested({ language: 'en' })).toBe('/a/c/d/')
        expect(x({ language: 'nl' })).toBe('/b/')
        expect(x.child({ language: 'nl' })).toBe('/b/c/')
        expect(x.child.nested({ language: 'nl' })).toBe('/b/c/d/')
        expect(() => x.child.nested({ language: 'de' })).toThrowError(/locale/)
      })
      test('localized root without trailing slash', () => {
        const { x } = asRouteMap(
          {
            x: {
              path: { en: 'a', nl: 'b' },
              child: {
                path: 'c',
                nested: 'd',
              }
            }
          },
          { trailingSlash: false }
        )
        expect(x({ language: 'en' })).toBe('/a')
        expect(x.child({ language: 'en' })).toBe('/a/c')
        expect(x.child.nested({ language: 'en' })).toBe('/a/c/d')
        expect(x({ language: 'nl' })).toBe('/b')
        expect(x.child({ language: 'nl' })).toBe('/b/c')
        expect(x.child.nested({ language: 'nl' })).toBe('/b/c/d')
        expect(() => x.child.nested({ language: 'de' })).toThrowError(/locale/)
      })
      test('combined dynamic reverse routing', () => {
        const map = asRouteMap({ x: {
          path: ':a/b',
          child: {
            path: { en: ':c/e', nl: ':d/f' },
            nested: ':g/h',
          }
        }})
        const { x } = map
        expect(x({ a: 'i' })).toBe('/i/b/')
        expect(x.child({ language: 'en', a: 'i', c: 'j', d: 'k' })).toBe('/i/b/j/e/')
        expect(x.child.nested({ language: 'en', a: 'i', c: 'j', d: 'k', g: 'l' })).toBe('/i/b/j/e/l/h/')
        expect(x({ a: 'i' })).toBe('/i/b/')
        expect(x.child({ language: 'nl', a: 'i', c: 'j', d: 'k' })).toBe('/i/b/k/f/')
        expect(x.child.nested({ language: 'nl', a: 'i', c: 'j', d: 'k', g: 'l' })).toBe('/i/b/k/f/l/h/')
      })
      test('combined dynamic reverse routing without trailing slash', () => {
        const map = asRouteMap(
          {
            x: {
              path: ':a/b',
              child: {
                path: { en: ':c/e', nl: ':d/f' },
                nested: ':g/h',
              }
            }
          },
          { trailingSlash: false }
        )
        const { x } = map
        expect(x({ a: 'i' })).toBe('/i/b')
        expect(x.child({ language: 'en', a: 'i', c: 'j', d: 'k' })).toBe('/i/b/j/e')
        expect(x.child.nested({ language: 'en', a: 'i', c: 'j', d: 'k', g: 'l' })).toBe('/i/b/j/e/l/h')
        expect(x({ a: 'i' })).toBe('/i/b')
        expect(x.child({ language: 'nl', a: 'i', c: 'j', d: 'k' })).toBe('/i/b/k/f')
        expect(x.child.nested({ language: 'nl', a: 'i', c: 'j', d: 'k', g: 'l' })).toBe('/i/b/k/f/l/h')
      })
    })
  })
  describe('toString', () => {
    test('single', () => {
      const { x } = asRouteMap({ x: '' })
      expect(`${x}`).toBe('x')
    })
    test('nested', () => {
      const { x } = asRouteMap({ x: { path: '', y: '' } })
      expect(`${x.y}`).toBe('x.y')
    })
  })
})

describe('match', () => {
  test('throw error for non-RouteMap', () => {
    // @ts-ignore
    expect(() => match({}, '')).toThrowError(/asRouteMap/)
  })
  test('route not found', () => {
    expect(match(asRouteMap({ y: 'z' }), '/x')).toBe(null)
  })
  test('route not found dynamic', () => {
    expect(match(asRouteMap({ x: { path: ':a', y: 'z' } }), '/x/y')).toBe(null)
  })
  describe('found', () => {
    test('static single', () => {
      const map = asRouteMap({ x: 'z' })
      expect(match(map, '/z').route).toBe(map.x)
    })
    test('static multiple', () => {
      const map = asRouteMap({ a: 'c', b: 'd' })
      expect(match(map, '/c').route).toBe(map.a)
      expect(match(map, '/d').route).toBe(map.b)
    })
    test('static nested', () => {
      const map = asRouteMap({
        a: { path: 'a', c: 'c', },
        b: { path: 'b', d: 'd', }
      })
      expect(match(map, '/a/c').route).toBe(map.a.c)
      expect(match(map, '/b/d').route).toBe(map.b.d)
    })
    test('static multiple segments', () => {
      const map = asRouteMap({ a: 'a/c', b: 'b/d' })
      expect(match(map, '/a/c').route).toBe(map.a)
      expect(match(map, '/b/d').route).toBe(map.b)
      expect(match(map, '/a/d')).toBe(null)
    })
    test('static empty child', () => {
      const map = asRouteMap({ a: { path: 'a', b: '' } })
      expect(match(map, '/a').route).toBe(map.a.b)
      expect(match(map, '/a/b')).toBe(null)
    })
    test('static localized error', () => {
      const map = asRouteMap({ x: { path: { en: 'y', nl: 'z' } } })
      expect(match(map, '/z')).toBe(null)
    })
    test('static localized', () => {
      const map = asRouteMap({ x: { path: ':language', y: { path: { en: 'y', nl: 'z' } } } })
      expect(match(map, '/en/y').route).toBe(map.x.y)
      expect(match(map, '/nl/z').route).toBe(map.x.y)
      expect(match(map, '/en/z')).toBe(null)
      expect(match(map, '/nl/y')).toBe(null)
      expect(match(map, '/de/y')).toBe(null)
    })
    test('dynamic single', () => {
      expect(match(asRouteMap({ x: ':y' }), '/z').params).toEqual({ y: 'z' })
    })
    test('dynamic nested multiple end', () => {
      const map = asRouteMap({ a: 'a/:c', b: 'b/:d' })
      const { params: a, route: b } = match(map, '/a/e')
      expect(a).toEqual({ c: 'e' })
      expect(b).toBe(map.a)
      const { params: c, route: d } = match(map, '/b/f')
      expect(c).toEqual({ d: 'f' })
      expect(d).toBe(map.b)
      expect(match(map, '/c/f')).toBe(null)
      expect(match(map, '/a')).toBe(null)
      expect(match(map, '/a/b/c')).toBe(null)
    })
    test('dynamic nested multiple start', () => {
      const map = asRouteMap({ a: ':c/a', b: ':d/b' })
      const { params: a, route: b } = match(map, '/x/a')
      expect(a).toEqual({ c: 'x' })
      expect(b).toBe(map.a)
      const { params: c, route: d } = match(map, '/x/b')
      expect(c).toEqual({ d: 'x' })
      expect(d).toBe(map.b)
      expect(match(map, '/x/c')).toBe(null)
    })
    test('dynamic double', () => {
      const map = asRouteMap({ a: { path: ':a', b: ':b' } })
      expect(match(map, '/c/d').params).toEqual({ a: 'c', b: 'd' })
    })
    test('multiple dynamic', () => {
      const map = asRouteMap({ a: ':b/:c' })
      const { params: a, route: b } = match(map, '/d/e')
      expect(a).toEqual({ b: 'd', c: 'e' })
      expect(b).toBe(map.a)
    })
    test('static before dynamic', () => {
      const map = asRouteMap({ a: ':c', b: 'b', c: '' })
      const { params: a, route: b } = match(map, '/b')
      expect(a).toEqual({})
      expect(b).toBe(map.b)
      const { params: c, route: d } = match(map, '/d')
      expect(c).toEqual({ c: 'd' })
      expect(d).toBe(map.a)
      const { params: e, route: f } = match(map, '/')
      expect(e).toEqual({})
      expect(f).toBe(map.c)
    })
    test('static before dynamic nested end', () => {
      const map = asRouteMap({ a: 'a/:c', b: 'a/b' })
      const { params: a, route: b } = match(map, '/a/b')
      expect(a).toEqual({})
      expect(b).toBe(map.b)
      const { params: c, route: d } = match(map, '/a/c')
      expect(c).toEqual({ c: 'c' })
      expect(d).toBe(map.a)
    })
    test('static before dynamic mixed', () => {
      const map = asRouteMap({ a: 'a/:b', b: ':a/b' })
      expect(match(map, '/a')).toBe(null)
      expect(match(map, '/b')).toBe(null)
      expect(match(map, '/a/a')).toEqual({ params: { b: 'a' }, route: map.a })
      expect(match(map, '/a/b')).toEqual({ params: { b: 'b' }, route: map.a })
      expect(match(map, '/b/b')).toEqual({ params: { a: 'b' }, route: map.b })
      expect(match(map, '/b/a')).toBe(null)
    })
    test('wildcard', () => {
      const map = asRouteMap({ a: 'a/*' })
      expect(match(map, '/a')).toBe(null)
      expect(match(map, '/a/b')).toEqual({ params: { '*': 'b' }, route: map.a })
      expect(match(map, '/a/b/c')).toEqual({ params: { '*': 'b/c' }, route: map.a })
    })
    test('static before wildcard', () => {
      const map = asRouteMap({ a: '*', b: 'b', c: '' })
      expect(match(map, '/a')).toEqual({ params: { '*': 'a' }, route: map.a })
      expect(match(map, '/b')).toEqual({ params: {}, route: map.b })
      expect(match(map, '/')).toEqual({ params: {}, route: map.c })
    })
    test('static before wildcard nested', () => {
      const map = asRouteMap({ a: '*', b: 'b/*', c: 'b', d: 'b/b', e: 'a/b' })
      expect(match(map, '/a')).toEqual({ params: { '*': 'a' }, route: map.a })
      expect(match(map, '/b')).toEqual({ params: {}, route: map.c })
      expect(match(map, '/b/a')).toEqual({ params: { '*': 'a' }, route: map.b })
      expect(match(map, '/b/b')).toEqual({ params: {}, route: map.d })
      expect(match(map, '/a/b')).toEqual({ params: {}, route: map.e })
      expect(match(map, '/a/b/c')).toEqual({ params: { '*': 'a/b/c' }, route: map.a })
    })
    test('dynamic before wildcard', () => {
      const map = asRouteMap({ a: '*', b: ':a' })
      expect(match(map, '/a')).toEqual({ params: { a: 'a' }, route: map.b })
    })
    test('dynamic before wildcard nested', () => {
      const map = asRouteMap({ a: '*', b: 'a/*', c: 'a/:a' })
      expect(match(map, '/a')).toEqual({ params: { '*': 'a' }, route: map.a })
      expect(match(map, '/b')).toEqual({ params: { '*': 'b' }, route: map.a })
      expect(match(map, '/a/b')).toEqual({ params: { a: 'b' }, route: map.c })
      expect(match(map, '/a/b/c')).toEqual({ params: { '*': 'b/c' }, route: map.b })
    })
    test('fallback wildcard nested children', () => {
      const map = asRouteMap({ a: '*', b: { path: 'b', c: 'c' } })
      expect(match(map, '/a')).toEqual({ params: { '*': 'a' }, route: map.a })
      expect(match(map, '/b')).toEqual({ params: {}, route: map.b })
      expect(match(map, '/b/c')).toEqual({ params: {}, route: map.b.c })
      expect(match(map, '/b/c/d')).toEqual({ params: { '*': 'b/c/d' }, route: map.a })
    })
    test('readable use case', () => {
      const map = asRouteMap({
        home: '',
        articles: {
          path: 'articles',

          article: {
            path: ':articleId',

            tab1: 'tab1',
            tab2: 'tab2',
            tabNotFound: '*',
          },
          special: {
            path: 'special',

            notFound: '*',
          }
        },
        notFound: '*',
      })
      function empty(route) { return { params: {}, route }}
      function article(id, route) { return { params: { articleId: id }, route } }

      expect(match(map, '/')).toEqual(empty(map.home))
      expect(match(map, '/none')).toEqual({ params: { '*': 'none' }, route: map.notFound })
      expect(match(map, '/none/')).toEqual({ params: { '*': 'none' }, route: map.notFound })
      expect(match(map, '/none/really')).toEqual({ params: { '*': 'none/really' }, route: map.notFound })
      expect(match(map, '/none/really/')).toEqual({ params: { '*': 'none/really' }, route: map.notFound })
      expect(match(map, '/articles')).toEqual(empty(map.articles))
      expect(match(map, '/articles/')).toEqual(empty(map.articles))
      expect(match(map, '/articles/special')).toEqual(empty(map.articles.special))
      expect(match(map, '/articles/special/')).toEqual(empty(map.articles.special))
      expect(match(map, '/articles/special/none')).toEqual({ params: { '*': 'none' }, route: map.articles.special.notFound })
      expect(match(map, '/articles/special/none/')).toEqual({ params: { '*': 'none' }, route: map.articles.special.notFound })
      expect(match(map, '/articles/abc')).toEqual(article('abc', map.articles.article))
      expect(match(map, '/articles/abc/')).toEqual(article('abc', map.articles.article))
      expect(match(map, '/articles/abc/tab1')).toEqual(article('abc', map.articles.article.tab1))
      expect(match(map, '/articles/abc/tab1/')).toEqual(article('abc', map.articles.article.tab1))
      expect(match(map, '/articles/abc/tab2')).toEqual(article('abc', map.articles.article.tab2))
      expect(match(map, '/articles/abc/tab2/')).toEqual(article('abc', map.articles.article.tab2))
      expect(match(map, '/articles/abc/none')).toEqual({ params: { articleId: 'abc', '*': 'none' }, route: map.articles.article.tabNotFound })
      expect(match(map, '/articles/abc/none/')).toEqual({ params: { articleId: 'abc', '*': 'none' }, route: map.articles.article.tabNotFound })
      expect(match(map, '/articles/abc/none/really')).toEqual({ params: { articleId: 'abc', '*': 'none/really' }, route: map.articles.article.tabNotFound })
      expect(match(map, '/articles/abc/none/really/')).toEqual({ params: { articleId: 'abc', '*': 'none/really' }, route: map.articles.article.tabNotFound })
    })
  })
})

describe('interpolate', () => {
  test('no interpolation', () => {
    const { a, b, c, d } = asRouteMap({ a: '', b: 'abc', c: 'abc/def', d: 'abc/def/ghi' })
    expect(a()).toBe('/')
    expect(b()).toBe('/abc/')
    expect(c()).toBe('/abc/def/')
    expect(d()).toBe('/abc/def/ghi/')
  })
  test('interpolation', () => {
    const { a, b, c, d, e, f, g, h, i, j, k, l } = asRouteMap({
      a: ':a',
      b: '*',
      c: ':a/b',
      d: 'b/:a',
      e: 'b/*',
      f: ':a/:a',
      g: ':a/*',
      h: 'a/:a/b',
      i: 'a/:a/b/*',
      j: 'a/:a/b/:b',
      // don't use these in real routes:
      k: 'a/abc:def/b',
      l: 'a/abc:def/b/*',
    })

    expect(a({ a: 'b' })).toBe('/b/')
    expect(b({ '*': 'b' })).toBe('/b/')
    expect(c({ a: 'b' })).toBe('/b/b/')
    expect(d({ a: 'b' })).toBe('/b/b/')
    expect(e({ '*': 'b' })).toBe('/b/b/')
    expect(f({ a: 'b' })).toBe('/b/b/')
    expect(g({ a: 'b', '*': 'c' })).toBe('/b/c/')
    expect(h({ a: 'b' })).toBe('/a/b/b/')
    expect(i({ a: 'b', '*': 'c' })).toBe('/a/b/b/c/')
    expect(j({ a: 'b', 'b': 'c' })).toBe('/a/b/b/c/')
    // @ts-ignore
    expect(k({ def: 'ghi' })).toBe('/a/abc:def/b/')
    // @ts-ignore
    expect(l({ def: 'ghi', '*': 'j' })).toBe('/a/abc:def/b/j/')
  })
})

describe('asRouteChain', () => {
  test('single', () => {
    const { x } = asRouteMap({ x: 'y' })
    expect(asRouteChain(x)).toEqual([x])
  })
  test('nested', () => {
    const { x } = asRouteMap({ x: { path: 'x', y: 'y' } })
    expect(asRouteChain(x.y)).toEqual([x, x.y])
  })
})

function expect(actual) {
  return /** @type const */ ({
    toStrictEqual(expected) {
      assert.strictEqual(actual, expected)
    },
    toBeDefined() {
      assert.notEqual(actual, undefined)
    },
    toBe(expected) {
      assert.strictEqual(actual, expected)
    },
    toEqual(expected) {
      assert.deepEqual(actual, expected)
    },
    toThrowError(expected) {
      assert.throws(actual, expected)
    },
    not: {
      toThrowError() {
        assert.doesNotThrow(actual)
      },
    }
  })
}

// /** @typedef {import('./types').RouteMap} RouteMap */
