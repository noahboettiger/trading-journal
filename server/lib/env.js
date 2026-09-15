import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Load an optional .env file, quietly.
 *
 * This is imported before anything that reads process.env, because ESM
 * evaluates imports in order and both db.js and backup.js read their paths at
 * module load. Node's --env-file-if-exists flag would also work, but it prints
 * "not found" on every start, which reads like an error when it is not.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const ENV_FILE = process.env.JOURNAL_ENV_FILE || path.join(ROOT, '.env')

if (fs.existsSync(ENV_FILE)) {
  try {
    process.loadEnvFile(ENV_FILE)
    console.log(`[config] loaded ${path.basename(ENV_FILE)}`)
  } catch (err) {
    console.error(`[config] could not read ${ENV_FILE}: ${err.message}`)
  }
}
