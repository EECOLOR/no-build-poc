import ts from 'typescript'

const defaultHost = ts.createCompilerHost({
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  strict: true,
  noEmit: true,
  allowJs: true,
})

/**
 * Compiles a set of code snippets in memory and returns any type diagnostics.
 *
 * @arg {Map<string, string>} fileContents A map of file paths to code content.
 * @returns {Array<{ fileName?: string, line: number, character: number, message: string }>}
 */
export function compileAndGetDiagnostics(fileContents) {
  const compilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    noEmit: true,
    allowJs: true,
  }
  const host = createCompilerHost(fileContents)
  const program = ts.createProgram([...fileContents.keys()], compilerOptions, host)
  const allDiagnostics = ts.getPreEmitDiagnostics(program)

  return allDiagnostics.map(formatDiagnostic)
}

/**
 * @param {ts.Diagnostic} diagnostic
 *
 * @returns {{ fileName: string, line: number, character: number, message: string }}
 */
function formatDiagnostic(diagnostic) {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
  const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start)

  return {
    fileName: diagnostic.file.fileName,
    line: line + 1,
    character: character + 1,
    message
  }
}

/**
 * A custom CompilerHost that provides our in-memory files and caches external files.
 *
 * @arg {Map<string, string>} inMemoryFiles
 * @returns {ts.CompilerHost}
 */
function createCompilerHost(inMemoryFiles) {
  return {
    getSourceFile(fileName, languageVersion) {
      if (inMemoryFiles.has(fileName))
        return ts.createSourceFile(fileName, inMemoryFiles.get(fileName), languageVersion)

      return defaultHost.getSourceFile(fileName, languageVersion)
    },
    getDefaultLibFileName(options) {
      return ts.getDefaultLibFilePath(options)
    },
    writeFile() {
      throw new Error(`Can not write files`)
    },
    getCurrentDirectory() {
      return process.cwd()
    },
    getCanonicalFileName(fileName) {
      return fileName
    },
    getNewLine() {
      return '\n'
    },
    useCaseSensitiveFileNames() {
      return true
    },
    fileExists(fileName) {
      return inMemoryFiles.has(fileName) || defaultHost.fileExists(fileName)
    },
    readFile(fileName) {
      if (inMemoryFiles.has(fileName))
        return inMemoryFiles.get(fileName)

      return defaultHost.readFile(fileName)
    },
    getDirectories(path) {
      return defaultHost.getDirectories(path)
    }
  }
}
