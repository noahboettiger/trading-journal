import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { UPLOAD_DIR } from '../lib/db.js'

export const uploadsRouter = Router()

const ALLOWED = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/avif', '.avif'],
])

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  // Generated name only. The client-supplied filename never touches the path.
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED.get(file.mimetype) ?? '.png'}`),
})

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.has(file.mimetype) ? cb(null, true) : cb(new Error(`Unsupported image type: ${file.mimetype}`)),
})

uploadsRouter.post('/', upload.array('files', 10), (req, res) => {
  res.status(201).json((req.files ?? []).map((f) => ({ path: `/uploads/${f.filename}`, size: f.size })))
})

uploadsRouter.delete('/:filename', (req, res) => {
  // Reject anything that is not a bare filename so this cannot escape the dir.
  const name = path.basename(req.params.filename)
  if (name !== req.params.filename) return res.status(400).json({ error: 'Invalid filename' })
  const target = path.join(UPLOAD_DIR, name)
  if (!fs.existsSync(target)) return res.status(404).json({ error: 'Not found' })
  fs.unlinkSync(target)
  res.status(204).end()
})
