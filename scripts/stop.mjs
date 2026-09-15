/**
 * Stop a running journal.
 *
 *   npm run stop
 *
 * The PID comes from the live server's own health endpoint rather than from the
 * pid file on disk. A pid file left behind by a crash can name a number the
 * operating system has since handed to an unrelated program, and killing that
 * would be its own kind of disaster. If nothing answers, nothing is running.
 */
import '../server/lib/env.js'

const PORT = process.env.PORT || 4317
const BASE = `http://localhost:${PORT}`

const ping = async () => {
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

const health = await ping()
if (!health?.pid) {
  console.log('The journal is not running.')
  process.exit(0)
}

// Force any debounced backup to disk before the process goes away. On Windows
// a kill is abrupt and the shutdown handler does not get to run.
try {
  await fetch(`${BASE}/api/backup/snapshot`, { method: 'POST', signal: AbortSignal.timeout(10000) })
} catch {
  /* best effort */
}

try {
  process.kill(health.pid)
} catch (err) {
  console.error(`Could not stop process ${health.pid}: ${err.message}`)
  process.exit(1)
}

// Wait for the port to actually free up, so a restart does not race it.
for (let i = 0; i < 40; i++) {
  if (!(await ping())) {
    console.log(`Stopped the journal (pid ${health.pid}).`)
    process.exit(0)
  }
  await new Promise((r) => setTimeout(r, 250))
}

console.error('The journal did not stop. Try ending the Node process in Task Manager.')
process.exit(1)
