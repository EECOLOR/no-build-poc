import { spawn } from 'node:child_process'

spawn(
  'node',
  [
    '--import', '#import-root-slash/register-hooks.js',
    '--import', '#import-browser/register-hooks.js',
    '--watch',
    '--watch-preserve-output',
    '--experimental-sqlite',
    '--experimental-import-meta-resolve',
    './index.js'
  ],
  { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] },
)
