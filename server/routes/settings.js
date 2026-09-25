import { Router } from 'express'
import { readSettings, writeSettings } from '../lib/settings.js'

export const settingsRouter = Router()

settingsRouter.get('/', (req, res) => res.json(readSettings()))

settingsRouter.put('/', (req, res, next) => {
  try {
    res.json(writeSettings(req.body ?? {}))
  } catch (err) {
    next(err)
  }
})
