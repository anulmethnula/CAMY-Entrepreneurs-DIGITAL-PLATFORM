import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

process.chdir(fileURLToPath(new URL('..', import.meta.url)))

const php = 'C:\\xampp\\php\\php.exe'
if (!existsSync(php)) {
  console.error('XAMPP PHP was not found at C:\\xampp\\php\\php.exe')
  process.exit(1)
}

// Check connectivity without creating tables or changing existing data.
const databaseCheck = spawnSync(php, ['-r', `
require 'api/config.php';
try {
    new PDO('mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';charset=utf8mb4', DB_USER, DB_PASS);
} catch (Throwable $error) {
    fwrite(STDERR, "CAMY cannot connect to MySQL. Start MySQL in XAMPP. If it stops immediately, inspect C:/xampp/mysql/data/mysql_error.log.\\n");
    exit(1);
}
`], { stdio: 'inherit' })
if (databaseCheck.error || databaseCheck.status !== 0) {
  if (databaseCheck.error) console.error(databaseCheck.error.message)
  process.exit(1)
}

const api = spawn(php, ['-S', '127.0.0.1:8000', '-t', 'api', 'api/index.php'], { stdio: 'inherit' })
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0', '--port', '8080'], { stdio: 'inherit' })

let stopping = false
const stop = () => {
  if (stopping) return
  stopping = true
  api.kill()
  vite.kill()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
for (const [name, child] of [['API', api], ['web server', vite]]) {
  child.on('error', error => {
    console.error(`CAMY ${name} could not start: ${error.message}`)
    process.exitCode = 1
    stop()
  })
  child.on('exit', code => {
    if (stopping) return
    console.error(`CAMY ${name} stopped. Check the output above and ensure ports 8000 and 8080 are available.`)
    process.exitCode = code || 1
    stop()
  })
}
