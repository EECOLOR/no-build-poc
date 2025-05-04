export async function resolve(specifier, context, nextResolve) {
  if (!specifier.endsWith('#browser'))
    return nextResolve(specifier, context)

  const [specifierWithoutSuffix] = specifier.split('#')
  return nextResolve(specifierWithoutSuffix, { ...context, conditions: ['browser', 'import'] })
}
