import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { appendPrices } from './db.js'
import { Price } from './model.js'
import assert from 'assert'
import { OnsMapping } from './schema.js'
const __dirname = dirname(fileURLToPath(import.meta.url)) + '/'

async function getPricesDb() {
  return await open({
    filename: __dirname + '../db/prices.db',
    driver: sqlite3.Database
  })
}

export async function collectPrices(fiats: { 'rub'?: true, 'usd'?: true }, start = 1585090800, to?: number) {
  const pricesDb = await getPricesDb()
  for(const fiat in fiats) {
    console.log(`Collecting prices for ${fiat}`)
    const prices: [number, number][] = []

    const interval = 90 * 24 * 60 * 60
    const end = Math.floor(to ?? (Date.now() / 1000))
    const loops = Math.ceil((end - start) / interval)
    for (let i = 0; i < loops; i++) {
      const startInterval = start + i * interval
      const endInterval = Math.min(start + (i + 1) * interval, end)
      console.log(`[${i + 1}/${loops}] Collecting prices from ${startInterval} (${new Date(startInterval * 1000)}) to ${endInterval} (${new Date(endInterval * 1000)})`)
      const result = await fetch('https://api.coingecko.com/api/v3/coins/loki-network/market_chart/range?' + new URLSearchParams({
        vs_currency: fiat,
        from: String(startInterval),
        to: String(endInterval),
        precision: 'full',
        x_cg_demo_api_key: String(process.env.COINGECKO_API_KEY)
      }), {
        // headers: {
        //   'x-cg-pro-api-key': String(process.env.COINGECKO_API_KEY)
        // }
      })
        .then(req => req.json()) as { prices: [number, number][] }
      if (!result.prices) {
        console.error(result)
        throw new Error('No prices')
      }
      
      prices.push(...result.prices)
    }

    await appendPrices(pricesDb, fiat as 'rub' | 'usd', prices)
  }
}

const OXEN_PER_ONS_NAME = 7.5
export async function calculatePurchasesCosts(fiat: 'rub' | 'usd', timestamps: number[]) {
  const pricesDb = await getPricesDb()
  const prices: number[] = []
  for(const timestamp of timestamps) {
    const oxenPrice = await pricesDb.get<Price>('SELECT price FROM prices WHERE fiat = :fiat AND timestamp <= :timestamp ORDER BY timestamp DESC LIMIT 1', {
      ':fiat': fiat,
      ':timestamp': timestamp
    })
    if (!oxenPrice) {
      throw new Error('No price is found for ' + fiat + ' ' + timestamp)
    }
    prices.push(oxenPrice.price * OXEN_PER_ONS_NAME)
  }
  return prices
}

export async function getMoneySpent(fiat: 'rub' | 'usd', owner: string) {
  const ons = await open({
    filename: __dirname + '../db/ons.db',
    driver: sqlite3.Database
  })

  let rows: Pick<OnsMapping, 'block_created_at'>[]
  if(owner.length === 160) {
    rows = await ons.all('SELECT block_created_at FROM mappings WHERE type="session" AND owner = ?', owner)
  } else {
    rows = await ons.all('SELECT block_created_at FROM mappings WHERE type="session" AND owner_oxen = ?', owner)
  }
  const timestamps = rows.map(r => r.block_created_at * 1000)
  const costs = await calculatePurchasesCosts(fiat, timestamps)
  return costs.reduce((a, b) => a + b, 0)
}

export async function updateHistoricalOxenPrices() {
  const pricesDb = await getPricesDb()
  const row = await pricesDb.get<{ timestamp: number }>('SELECT timestamp FROM prices ORDER BY timestamp DESC LIMIT 1')
  assert(row)
  await collectPrices({ rub: true, usd: true }, Math.floor(row.timestamp / 1000) + 1)
}