import { existsSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

function addCandidate(list, value) {
  const candidate = String(value || '').trim().replace(/^"|"$/g, '')
  if (candidate && !list.includes(candidate)) list.push(candidate)
}

export function phpCandidates() {
  const candidates = []
  addCandidate(candidates, process.env.CAMY_PHP_PATH)

  if (process.platform === 'win32') {
    const where = spawnSync('where.exe', ['php.exe'], { encoding: 'utf8', windowsHide: true })
    if (where.status === 0) {
      for (const line of String(where.stdout || '').split(/\r?\n/)) addCandidate(candidates, line)
    }

    for (let code = 67; code <= 90; code += 1) {
      const drive = String.fromCharCode(code) + ':\\'
      if (!existsSync(drive)) continue

      addCandidate(candidates, path.join(drive, 'xampp', 'php', 'php.exe'))
      addCandidate(candidates, path.join(drive, 'XAMPP', 'php', 'php.exe'))

      try {
        for (const entry of readdirSync(drive, { withFileTypes: true })) {
          if (!entry.isDirectory() || !/^xampp/i.test(entry.name)) continue
          addCandidate(candidates, path.join(drive, entry.name, 'php', 'php.exe'))
        }
      } catch {
        // Some drive roots may not allow directory enumeration. Standard XAMPP
        // locations above are still checked.
      }
    }

    addCandidate(candidates, 'C:\\Program Files\\xampp\\php\\php.exe')
    addCandidate(candidates, 'C:\\Program Files (x86)\\xampp\\php\\php.exe')
  } else {
    const which = spawnSync('which', ['php'], { encoding: 'utf8' })
    if (which.status === 0) addCandidate(candidates, String(which.stdout || '').split(/\r?\n/)[0])
  }

  return candidates
}

export function resolvePhp() {
  return phpCandidates().find(candidate => existsSync(candidate)) || null
}
