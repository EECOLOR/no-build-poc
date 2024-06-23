How to deal with:
- fingerprinting - can be done, but should be done in a build step for production
- libraries - works
- config
- escaping (see https://github.com/WebReflection/html-escaper, https://github.com/preactjs/preact-render-to-string/blob/main/src/lib/util.js#L11, https://github.com/preactjs/preact-render-to-string/blob/main/src/index.js#L536)


About context. Context is a tricky beast. Take the following example:

```js
function CustomComponent() {
  return (
    Provider(
      ChildThatUsesProvider()
    )
  )
}
```

When using this type of structure the `ChildThatUsesProvider` has been executed before the provider is being executed. This could be solved by using a callback:

```js
Provider(
  () => ChildThatUsesProvider()
)
```

That would however only fix the problems on the first render. When signals change the DOM structure stuff becomes a little more complicated and it would become hard to determine how to get context values. Theoretically the DOM could be used, but that would require us to bind DOM nodes to components.

These kinds of problems could more easily be solved when using the concept of a component tree. Having simple functions as components makes this more complicated.

Tags use (at the time of writing) this structure. Calling `div(...)` returns a `Tag` with `{ tagName, attributes, children }`. The reason for this is that we want to render them differently on client and server. On top of that, it makes escaping far easier because we clearly know that a `string` comes from the user. If tags returned a string on the server we would not know the difference between `'example1'` and `p('example2')` in `div('example1', p('example2'))`. The literal texts should be escaped, but the `<p>...</p>` should not be escaped.

A solution would be a `component` function that would be used like this:

```js
export const MyComponent = component(({ title, content }) => {
  return (
    div(
      h1(title),
      p(content),
    )
  )
})
```

Somehow I don't like that compared with:

```js
export function MyComponent({ title, content }) {
  return (
    div(
      h1(title),
      p(content),
    )
  )
}
```

JSX solves this because it hides the `component(...)` call. JSX however requires compilation.

Looking back at our use of context in the past, I am not sure I can make the case for needing contexts. A simple Signal in a separate module would in most cases be enough as the context is not really a context, but a 'global' state that is only known at some point in time.
