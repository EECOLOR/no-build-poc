// Here we could switch to a non-watch app
const importedApp = await import('./watch-app.js')

export const app = importedApp.app
