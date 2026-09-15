import { Router } from 'express'
import { db } from '../lib/db.js'
import { createTrade, updateTrade, getTrade, deleteTrade, listTrades, nextTradeNumber } from '../lib/trades.js'

export const tradesRouter = Router()

tradesRouter.get('/next-number', (_req, res) => {
  res.json({ trade_no: nextTradeNumber() })
})

tradesRouter.get('/', (req, res) => {
  res.json(listTrades({ ...req.query, withChildren: req.query.withChildren !== 'false' }))
})

tradesRouter.get('/:id', (req, res) => {
  const trade = getTrade(Number(req.params.id))
  if (!trade) return res.status(404).json({ error: 'Trade not found' })
  res.json(trade)
})

tradesRouter.post('/', (req, res, next) => {
  try {
    res.status(201).json(createTrade(req.body))
  } catch (err) {
    next(err)
  }
})

tradesRouter.put('/:id', (req, res, next) => {
  try {
    const trade = updateTrade(Number(req.params.id), req.body)
    if (!trade) return res.status(404).json({ error: 'Trade not found' })
    res.json(trade)
  } catch (err) {
    next(err)
  }
})

tradesRouter.delete('/:id', (req, res) => {
  if (!deleteTrade(Number(req.params.id))) return res.status(404).json({ error: 'Trade not found' })
  res.status(204).end()
})

/** Distinct values already used, to power filter dropdowns and autocomplete. */
tradesRouter.get('/meta/facets', (_req, res) => {
  const distinct = (col) =>
    db.prepare(`SELECT DISTINCT ${col} AS v FROM trades WHERE ${col} IS NOT NULL AND ${col} != '' ORDER BY v`)
      .all()
      .map((r) => r.v)
  res.json({
    symbols: distinct('symbol'),
    setups: distinct('setup'),
    sessions: distinct('session'),
    timeframes: distinct('timeframe'),
    sources: distinct('trade_source'),
  })
})
