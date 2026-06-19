import { spawn } from 'node:child_process'

const forwardedArgs = process.argv.slice(2)
const sanitizedArgs =
  forwardedArgs[0] === '--' ? forwardedArgs.slice(1) : forwardedArgs

const child = spawn(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  [
    'exec',
    'vitest',
    '--config',
    'vitest.config.ts',
    'run',
    ...sanitizedArgs,
  ],
  {
    stdio: 'inherit',
  },
)

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})

