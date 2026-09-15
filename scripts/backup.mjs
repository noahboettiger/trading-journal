/**
 * Take a backup snapshot right now, without needing the server running.
 *
 *   npm run backup
 *
 * Writes a complete, self-contained copy to data/backups/. Safe to run any
 * time, including while the journal is open in a browser.
 */
import { snapshot, snapshotDir } from '../server/lib/backup.js'

const result = snapshot({ label: 'manual' })
console.log(`Snapshot saved to ${result.path}`)
console.log(`(${(result.size / 1024).toFixed(0)} KB, keeping the 30 most recent in ${snapshotDir})`)
console.log('\nRemember: chart screenshots live in data/uploads and are not in this file.')
console.log('Copying the whole data/ folder is the complete backup.')
