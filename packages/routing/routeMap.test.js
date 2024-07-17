import { describe, test } from 'node:test'
import assert from 'node:assert'

import { asRouteChain, asRouteMap, pick, routeMapSymbol, routeSymbol } from './routeMap.js'

describe('asRouteMap', () => {

  test('routeMapSymbol', () => {
    expect(asRouteMap({})[routeMapSymbol]).toStrictEqual({ children: [] })
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
      expect(x[routeSymbol]).toEqual(objectContaining({ parent: null }))
    })

    test('static', () => {
      const { x } = asRouteMap({ x: 'y' })
      expect(x.path).toBe('y')
      expect(x()).toBe('/y')
    })

    test('dynamic', () => {
      const { x } = asRouteMap({ x: 'a/:x/b' })
      expect(x.path).toBe('a/:x/b')
      expect(x({ x: 'y' })).toBe('/a/y/b')
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
        expect(() => map.x.y({ language: 'de' })).toThrowError(/language/)
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

            a: { path: { nl: 'a', en: 'b' } } },
        })

        expect(pick('nl/a', [map, (_, x) => x])).toBe(map.language.a)
        expect(map.language.a({ language: 'nl' })).toBe('/nl/a')
        expect(pick('en/a', [map, (_, x) => x])).toBe(null)

        expect(pick('en/b', [map, (_, x) => x])).toBe(map.language.a)
        expect(map.language.a({ language: 'en' })).toBe('/en/b')
        expect(pick('nl/b', [map, (_, x) => x])).toBe(null)
      })
      test('language - custom language param name', () => {
        const map = asRouteMap(
          {
            language: {
              path: ':locale',

              a: { path: { nl: 'a', en: 'b' } } },
          },
          {
            languageParamName: 'locale'
          }
        )

        expect(pick('nl/a', [map, (_, x) => x])).toBe(map.language.a)
        expect(map.language.a({ locale: 'nl' })).toBe('/nl/a')
        expect(pick('en/a', [map, (_, x) => x])).toBe(null)

        expect(pick('en/b', [map, (_, x) => x])).toBe(map.language.a)
        expect(map.language.a({ locale: 'en' })).toBe('/en/b')
        expect(pick('nl/b', [map, (_, x) => x])).toBe(null)
      })
    })
    describe('reverse routing', () => {
      test('path static', () => {
        const { x } = asRouteMap({ x: { path: 'y' } })
        expect(x()).toBe('/y')
      })
      test('path dynamic', () => {
        const map = asRouteMap({ x: { path: 'a/:y/b' } })
        expect(map.x({ y: 'z' })).toBe('/a/z/b')
      })
      test('localized path static', () => {
        const path = { en: 'a', nl: 'b' }
        const { x } = asRouteMap({ x: { path } })
        expect(x({ language: 'en' })).toEqual('/a')
        expect(x({ language: 'nl' })).toEqual('/b')
      })
      test('localized path dynamic', () => {
        const map = asRouteMap({ x: { path: { en: 'x/:a/y', nl: 'a/:b/b' }
       } })
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
        })
        expect(x({ language: 'en' })).toBe('/en')
        expect(x.y({ language: 'en' })).toBe('/en/a')
        expect(x({ language: 'nl' })).toBe('/nl')
        expect(x.y({ language: 'nl' })).toBe('/nl/b')
        expect(x({ language: 'de' })).toBe('/de')
        expect(() => x.y({ language: 'de' })).toThrowError(/language/)
      })
    })
    describe('reverse routing with trailing slash', () => {
      test('path static', () => {
        const { x } = asRouteMap({ x: { path: 'y' } }, { trailingSlash: true })
        expect(x()).toBe('/y/')
      })
      test('path dynamic', () => {
        const map = asRouteMap({ x: { path: 'a/:y/b' } }, { trailingSlash: true })
        expect(map.x({ y: 'z' })).toBe('/a/z/b/')
      })
      test('localized path static', () => {
        const path = { en: 'a', nl: 'b' }
        const { x } = asRouteMap({ x: { path } }, { trailingSlash: true })
        expect(x({ language: 'en' })).toEqual('/a/')
        expect(x({ language: 'nl' })).toEqual('/b/')
      })
      test('localized path dynamic', () => {
        const map = asRouteMap(
          { x: { path: { en: 'x/:a/y', nl: 'a/:b/b' } } },
          { trailingSlash: true }
        )
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
        expect(x({ language: 'en' })).toBe('/en')
        expect(x.y({ language: 'en' })).toBe('/en/a')
        expect(x({ language: 'nl' })).toBe('/nl')
        expect(x.y({ language: 'nl' })).toBe('/nl/b')
        expect(x({ language: 'de' })).toBe('/de')
        expect(() => x.y({ language: 'de' })).toThrowError(/language/)
      })
    })
    describe('child routes', () => {
      test('minimal', () => {
        const { x } = asRouteMap({ x: { path: 'y', child: 'z' } })
        expect(x.child).toBeDefined()
        expect(x.child.path).toBe('z')
        expect(x()).toBe('/y')
        expect(x.child()).toBe('/y/z')
      })
      test('minimal with trailing slash', () => {
        const { x } = asRouteMap({ x: { path: 'y', child: 'z' } }, { trailingSlash: true })
        expect(x()).toBe('/y/')
        expect(x.child()).toBe('/y/z/')
      })
      test('nested', () => {
        const { x } = asRouteMap({ x: { path: 'a', child: { path: 'b', nested: 'c' } } })
        expect(x.child.nested).toBeDefined()
        expect(x()).toBe('/a')
        expect(x.child()).toBe('/a/b')
        expect(x.child.nested()).toBe('/a/b/c')
      })
      test('nested with trailing slash', () => {
        const { x } = asRouteMap({ x: { path: 'a', child: { path: 'b', nested: 'c' } } }, { trailingSlash: true })
        expect(x()).toBe('/a/')
        expect(x.child()).toBe('/a/b/')
        expect(x.child.nested()).toBe('/a/b/c/')
      })
      test('localized leaf', () => {
        const { x } = asRouteMap({ x: {
          path: 'a',
          child: {
            path: 'b',
            nested: { path: { en: 'c', nl: 'd' } },
          }
        }})
        expect(x()).toBe('/a')
        expect(x.child()).toBe('/a/b')
        expect(x.child.nested({ language: 'en' })).toBe('/a/b/c')
        expect(x.child.nested({ language: 'nl' })).toBe('/a/b/d')
        expect(() => x.child.nested({ language: 'de' })).toThrowError(/language/)
      })
      test('localized leaf with trailing slash', () => {
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
          { trailingSlash: true }
        )
        expect(x()).toBe('/a/')
        expect(x.child()).toBe('/a/b/')
        expect(x.child.nested({ language: 'en' })).toBe('/a/b/c/')
        expect(x.child.nested({ language: 'nl' })).toBe('/a/b/d/')
        expect(() => x.child.nested({ language: 'de' })).toThrowError(/language/)
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
        expect(x()).toBe('/a')
        expect(x.child({ language: 'en' })).toBe('/a/b')
        expect(x.child.nested({ language: 'en' })).toBe('/a/b/d')
        expect(x.child({ language: 'nl' })).toBe('/a/c')
        expect(x.child.nested({ language: 'nl' })).toBe('/a/c/d')
        expect(() => x.child.nested({ language: 'de' })).toThrowError(/language/)
      })
      test('localized branch with trailing slash', () => {
        const map = {
          path: 'a',
          child: {
            path: { en: 'b', nl: 'c' },
            nested: 'd',
          }
        }
        const { x } = asRouteMap({ x: map }, { trailingSlash: true })
        expect(x()).toBe('/a/')
        expect(x.child({ language: 'en' })).toBe('/a/b/')
        expect(x.child.nested({ language: 'en' })).toBe('/a/b/d/')
        expect(x.child({ language: 'nl' })).toBe('/a/c/')
        expect(x.child.nested({ language: 'nl' })).toBe('/a/c/d/')
        expect(() => x.child.nested({ language: 'de' })).toThrowError(/language/)
      })
      test('localized root', () => {
        const { x } = asRouteMap({ x: {
          path: { en: 'a', nl: 'b' },
          child: {
            path: 'c',
            nested: 'd',
          }
        } })
        expect(x({ language: 'en' })).toBe('/a')
        expect(x.child({ language: 'en' })).toBe('/a/c')
        expect(x.child.nested({ language: 'en' })).toBe('/a/c/d')
        expect(x({ language: 'nl' })).toBe('/b')
        expect(x.child({ language: 'nl' })).toBe('/b/c')
        expect(x.child.nested({ language: 'nl' })).toBe('/b/c/d')
        expect(() => x.child.nested({ language: 'de' })).toThrowError(/language/)
      })
      test('localized root with trailing slash', () => {
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
          { trailingSlash: true }
        )
        expect(x({ language: 'en' })).toBe('/a/')
        expect(x.child({ language: 'en' })).toBe('/a/c/')
        expect(x.child.nested({ language: 'en' })).toBe('/a/c/d/')
        expect(x({ language: 'nl' })).toBe('/b/')
        expect(x.child({ language: 'nl' })).toBe('/b/c/')
        expect(x.child.nested({ language: 'nl' })).toBe('/b/c/d/')
        expect(() => x.child.nested({ language: 'de' })).toThrowError(/language/)
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
        expect(x({ a: 'i' })).toBe('/i/b')
        expect(x.child({ language: 'en', a: 'i', c: 'j', d: 'k' })).toBe('/i/b/j/e')
        expect(x.child.nested({ language: 'en', a: 'i', c: 'j', d: 'k', g: 'l' })).toBe('/i/b/j/e/l/h')
        expect(x({ a: 'i' })).toBe('/i/b')
        expect(x.child({ language: 'nl', a: 'i', c: 'j', d: 'k' })).toBe('/i/b/k/f')
        expect(x.child.nested({ language: 'nl', a: 'i', c: 'j', d: 'k', g: 'l' })).toBe('/i/b/k/f/l/h')
      })
      test('combined dynamic reverse routing with trailing slash', () => {
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
          { trailingSlash: true }
        )
        const { x } = map
        expect(x({ a: 'i' })).toBe('/i/b/')
        expect(x.child({ language: 'en', a: 'i', c: 'j', d: 'k' })).toBe('/i/b/j/e/')
        expect(x.child.nested({ language: 'en', a: 'i', c: 'j', d: 'k', g: 'l' })).toBe('/i/b/j/e/l/h/')
        expect(x({ a: 'i' })).toBe('/i/b/')
        expect(x.child({ language: 'nl', a: 'i', c: 'j', d: 'k' })).toBe('/i/b/k/f/')
        expect(x.child.nested({ language: 'nl', a: 'i', c: 'j', d: 'k', g: 'l' })).toBe('/i/b/k/f/l/h/')
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

describe('pick', () => {
  test('throw error for non-RouteMap', () => {
    // @ts-ignore
    expect(() => pick('', [{}])).toThrowError(/asRouteMap/)
  })
  test('route not found', () => {
    expect(pick('/x', [asRouteMap({ y: 'z' }), 'a'])).toBe(null)
  })
  test('route not found dynamic', () => {
    expect(pick('/x/y', [asRouteMap({ x: { path: ':a', y: 'z' } }), 'a'])).toBe(null)
  })
  describe('found', () => {
    test('static single', () => {
      expect(pick('/z', [asRouteMap({ x: 'z' }), 'a'])).toBe('a')
    })
    test('static multiple', () => {
      const map = asRouteMap({ a: 'c', b: 'd' })
      expect(pick('/c', [map, (_, x) => x])).toBe(map.a)
      expect(pick('/d', [map, (_, x) => x])).toBe(map.b)
    })
    test('static nested', () => {
      const map = asRouteMap({
        a: { path: 'a', c: 'c', },
        b: { path: 'b', d: 'd', }
      })
      expect(pick('/a/c', [map, (_, x) => x])).toBe(map.a.c)
      expect(pick('/b/d', [map, (_, x) => x])).toBe(map.b.d)
    })
    test('static multiple segments', () => {
      const map = asRouteMap({ a: 'a/c', b: 'b/d' })
      expect(pick('/a/c', [map, (_, x) => x])).toBe(map.a)
      expect(pick('/b/d', [map, (_, x) => x])).toBe(map.b)
      expect(pick('/a/d', [map, (_, x) => 'a'])).toBe(null)
    })
    test('static empty child', () => {
      const map = asRouteMap({ a: { path: 'a', b: '' } })
      expect(pick('/a', [map, (_, x) => x])).toBe(map.a.b)
      expect(pick('/a/b', [map, (_, x) => x])).toBe(null)
    })
    test('static localized error', () => {
      const map = asRouteMap({ x: { path: { en: 'y', nl: 'z' } } })
      expect(pick('/z', [map, 'a'])).toBe(null)
    })
    test('static localized', () => {
      const map = asRouteMap({ x: { path: ':language', y: { path: { en: 'y', nl: 'z' } } } })
      expect(pick('/en/y', [map, 'a'])).toBe('a')
      expect(pick('/nl/z', [map, 'a'])).toBe('a')
      expect(pick('/en/z', [map, 'a'])).toBe(null)
      expect(pick('/nl/y', [map, 'a'])).toBe(null)
      expect(pick('/de/y', [map, 'a'])).toBe(null)
    })
    test('dynamic single', () => {
      expect(pick('/z', [asRouteMap({ x: ':y' }), x => x])).toEqual({ y: 'z' })
    })
    test('dynamic nested multiple end', () => {
      const map = asRouteMap({ a: 'a/:c', b: 'b/:d' })
      const [a, b] = pick('/a/e', [map, asTuple])
      expect(a).toEqual({ c: 'e' })
      expect(b).toBe(map.a)
      const [c, d] = pick('/b/f', [map, asTuple])
      expect(c).toEqual({ d: 'f' })
      expect(d).toBe(map.b)
      expect(pick('/c/f', [map, asTuple])).toBe(null)
      expect(pick('/a', [map, asTuple])).toBe(null)
      expect(pick('/a/b/c', [map, asTuple])).toBe(null)
    })
    test('dynamic nested multiple start', () => {
      const map = asRouteMap({ a: ':c/a', b: ':d/b' })
      const [a, b] = pick('/x/a', [map, asTuple])
      expect(a).toEqual({ c: 'x' })
      expect(b).toBe(map.a)
      const [c, d] = pick('/x/b', [map, asTuple])
      expect(c).toEqual({ d: 'x' })
      expect(d).toBe(map.b)
      expect(pick('/x/c', [map, asTuple])).toBe(null)
    })
    test('dynamic double', () => {
      const map = asRouteMap({ a: { path: ':a', b: ':b' } })
      expect(pick('/c/d', [map, x => x])).toEqual({ a: 'c', b: 'd' })
    })
    test('multiple dynamic', () => {
      const map = asRouteMap({ a: ':b/:c' })
      const [a, b] = pick('/d/e', [map, asTuple])
      expect(a).toEqual({ b: 'd', c: 'e' })
      expect(b).toBe(map.a)
    })
    test('static before dynamic', () => {
      const map = asRouteMap({ a: ':c', b: 'b', c: '' })
      const [a, b] = pick('/b', [map, asTuple])
      expect(a).toEqual({})
      expect(b).toBe(map.b)
      const [c, d] = pick('/d', [map, asTuple])
      expect(c).toEqual({ c: 'd' })
      expect(d).toBe(map.a)
      const [e, f] = pick('/', [map, asTuple])
      expect(e).toEqual({})
      expect(f).toBe(map.c)
    })
    test('static before dynamic nested end', () => {
      const map = asRouteMap({ a: 'a/:c', b: 'a/b' })
      const [a, b] = pick('/a/b', [map, asTuple])
      expect(a).toEqual({})
      expect(b).toBe(map.b)
      const [c, d] = pick('/a/c', [map, asTuple])
      expect(c).toEqual({ c: 'c' })
      expect(d).toBe(map.a)
    })
    test('static before dynamic mixed', () => {
      const map = asRouteMap({ a: 'a/:b', b: ':a/b' })
      expect(pick('/a', [map, asTuple])).toBe(null)
      expect(pick('/b', [map, asTuple])).toBe(null)
      expect(pick('/a/a', [map, asTuple])).toEqual([{ b: 'a' }, map.a])
      expect(pick('/a/b', [map, asTuple])).toEqual([{ b: 'b' }, map.a])
      expect(pick('/b/b', [map, asTuple])).toEqual([{ a: 'b' }, map.b])
      expect(pick('/b/a', [map, asTuple])).toBe(null)
    })
    test('wildcard', () => {
      const map = asRouteMap({ a: 'a/*' })
      expect(pick('/a', [map, asTuple])).toBe(null)
      expect(pick('/a/b', [map, asTuple])).toEqual([{ '*': 'b' }, map.a])
      expect(pick('/a/b/c', [map, asTuple])).toEqual([{ '*': 'b/c' }, map.a])
    })
    test('static before wildcard', () => {
      const map = asRouteMap({ a: '*', b: 'b', c: '' })
      expect(pick('/a', [map, asTuple])).toEqual([{ '*': 'a' }, map.a])
      expect(pick('/b', [map, asTuple])).toEqual([{}, map.b])
      expect(pick('/', [map, asTuple])).toEqual([{}, map.c])
    })
    test('static before wildcard nested', () => {
      const map = asRouteMap({ a: '*', b: 'b/*', c: 'b', d: 'b/b', e: 'a/b' })
      expect(pick('/a', [map, asTuple])).toEqual([{ '*': 'a' }, map.a])
      expect(pick('/b', [map, asTuple])).toEqual([{}, map.c])
      expect(pick('/b/a', [map, asTuple])).toEqual([{ '*': 'a' }, map.b])
      expect(pick('/b/b', [map, asTuple])).toEqual([{}, map.d])
      expect(pick('/a/b', [map, asTuple])).toEqual([{}, map.e])
      expect(pick('/a/b/c', [map, asTuple])).toEqual([{ '*': 'a/b/c' }, map.a])
    })
    test('dynamic before wildcard', () => {
      const map = asRouteMap({ a: '*', b: ':a' })
      expect(pick('/a', [map, asTuple])).toEqual([{ a: 'a' }, map.b])
    })
    test('dynamic before wildcard nested', () => {
      const map = asRouteMap({ a: '*', b: 'a/*', c: 'a/:a' })
      expect(pick('/a', [map, asTuple])).toEqual([{ '*': 'a' }, map.a])
      expect(pick('/b', [map, asTuple])).toEqual([{ '*': 'b' }, map.a])
      expect(pick('/a/b', [map, asTuple])).toEqual([{ a: 'b' }, map.c])
      expect(pick('/a/b/c', [map, asTuple])).toEqual([{ '*': 'b/c' }, map.b])
    })
    test('fallback wildcard nested children', () => {
      const map = asRouteMap({ a: '*', b: { path: 'b', c: 'c' } })
      expect(pick('/a', [map, asTuple])).toEqual([{ '*': 'a' }, map.a])
      expect(pick('/b', [map, asTuple])).toEqual([{}, map.b])
      expect(pick('/b/c', [map, asTuple])).toEqual([{}, map.b.c])
      expect(pick('/b/c/d', [map, asTuple])).toEqual([{ '*': 'b/c/d' }, map.a])

    })
    test('readable use case', () => {
      console.time('a')
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
      /** @type {[RouteMap, typeof asTuple]} */
      const x = [map, asTuple]
      function empty(route) { return [{}, route]}
      function article(id, route) { return [{ articleId: id }, route] }
      console.timeEnd('a')
      console.time('b')
      expect(pick('/', x)).toEqual(empty(map.home))
      expect(pick('/none' , x)).toEqual([{ '*': 'none' }, map.notFound])
      expect(pick('/none/', x)).toEqual([{ '*': 'none' }, map.notFound])
      expect(pick('/none/really', x)).toEqual([{ '*': 'none/really' }, map.notFound])
      expect(pick('/none/really/', x)).toEqual([{ '*': 'none/really' }, map.notFound])
      expect(pick('/articles' , x)).toEqual(empty(map.articles))
      expect(pick('/articles/' , x)).toEqual(empty(map.articles))
      expect(pick('/articles/special' , x)).toEqual(empty(map.articles.special))
      expect(pick('/articles/special/' , x)).toEqual(empty(map.articles.special))
      expect(pick('/articles/special/none' , x)).toEqual([{ '*': 'none' }, map.articles.special.notFound])
      expect(pick('/articles/special/none/' , x)).toEqual([{ '*': 'none' }, map.articles.special.notFound])
      expect(pick('/articles/abc', x)).toEqual(article('abc', map.articles.article))
      expect(pick('/articles/abc/', x)).toEqual(article('abc', map.articles.article))
      expect(pick('/articles/abc/tab1' , x)).toEqual(article('abc', map.articles.article.tab1))
      expect(pick('/articles/abc/tab1/' , x)).toEqual(article('abc', map.articles.article.tab1))
      expect(pick('/articles/abc/tab2' , x)).toEqual(article('abc', map.articles.article.tab2))
      expect(pick('/articles/abc/tab2/' , x)).toEqual(article('abc', map.articles.article.tab2))
      expect(pick('/articles/abc/none' , x)).toEqual([{ articleId: 'abc', '*': 'none' }, map.articles.article.tabNotFound])
      expect(pick('/articles/abc/none/' , x)).toEqual([{ articleId: 'abc', '*': 'none' }, map.articles.article.tabNotFound])
      expect(pick('/articles/abc/none/really' , x)).toEqual([{ articleId: 'abc', '*': 'none/really' }, map.articles.article.tabNotFound])
      expect(pick('/articles/abc/none/really/' , x)).toEqual([{ articleId: 'abc', '*': 'none/really' }, map.articles.article.tabNotFound])
      console.timeEnd('b')
    })
    test('overrides', () => {
      const map = asRouteMap({ a: 'a', b: 'b' })
      expect(pick('/a', [map, 'a'], [map.b, 'b'])).toBe('a')
      expect(pick('/b', [map, 'a'], [map.b, 'b'])).toBe('b')
      expect(pick('/c', [map, 'a'], [map.b, 'b'])).toBe(null)
    })
  })
})

describe('interpolate', () => {
  test('no interpolation', () => {
    const { a, b, c, d } = asRouteMap({ a: '', b: 'abc', c: 'abc/def', d: 'abc/def/ghi' })
    expect(a()).toBe('/')
    expect(b()).toBe('/abc')
    expect(c()).toBe('/abc/def')
    expect(d()).toBe('/abc/def/ghi')
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

    expect(a({ a: 'b' })).toBe('/b')
    expect(b({ '*': 'b' })).toBe('/b')
    expect(c({ a: 'b' })).toBe('/b/b')
    expect(d({ a: 'b' })).toBe('/b/b')
    expect(e({ '*': 'b' })).toBe('/b/b')
    expect(f({ a: 'b' })).toBe('/b/b')
    expect(g({ a: 'b', '*': 'c' })).toBe('/b/c')
    expect(h({ a: 'b' })).toBe('/a/b/b')
    expect(i({ a: 'b', '*': 'c' })).toBe('/a/b/b/c')
    expect(j({ a: 'b', 'b': 'c' })).toBe('/a/b/b/c')
    // @ts-ignore
    expect(k({ def: 'ghi' })).toBe('/a/abcghi/b')
    // @ts-ignore
    expect(l({ def: 'ghi', '*': 'j' })).toBe('/a/abcghi/b/j')
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

function asTuple(...args) { return args }

/** @typedef {import('./types').RouteMap} RouteMap */

function objectContaining(obj) { return new ObjectContaining(obj) }
class ObjectContaining {
  constructor(obj) { this.obj = obj }
}

function expect(actual) {
  return {
    toStrictEqual(expected) {
      assert.deepStrictEqual(actual, expected)
    },
    toBeDefined() {
      assert.notStrictEqual(actual, undefined)
    },
    toEqual(expected) {
      if (expected instanceof ObjectContaining) {
        const x = Object.keys(expected.obj).reduce((result, k) => (result[k] = actual[k], result), {})
        assert.deepEqual(x, expected.obj)
      } else {
        assert.deepEqual(actual, expected)
      }
    },
    toBe(expected) {
      assert.strictEqual(actual, expected)
    },
    toThrowError(regex) {
      assert.throws(actual, regex)
    },
    not: {
      toThrowError(regex) {
        assert.doesNotThrow(actual, regex)
      }
    }
  }
}
