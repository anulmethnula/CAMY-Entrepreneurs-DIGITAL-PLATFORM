import { spawnSync } from 'node:child_process'
import { phpCandidates, resolvePhp } from './find-php.mjs'

const php = resolvePhp()
if (!php) {
  console.error('CAMY could not find PHP from your XAMPP installation.')
  console.error('Checked PHP on PATH, CAMY_PHP_PATH, and XAMPP folders on available Windows drives.')
  console.error('If XAMPP is installed in a custom folder, run:')
  console.error("  $env:CAMY_PHP_PATH='D:\\your-xampp-folder\\php\\php.exe'")
  console.error('Then run the command again.')
  const candidates = phpCandidates()
  if (candidates.length) console.error('Checked:', candidates.join(', '))
  process.exit(1)
}

const args = process.argv.slice(2)
const result = spawnSync(php, args, { stdio: 'inherit', windowsHide: true })

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}
process.exit(result.status ?? 1)
