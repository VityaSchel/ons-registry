import './env.js'
import Fastify from 'fastify'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { decryptONSValue, hash } from './encryption.js'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { OnsMapping } from './schema.js'
import { onsNameRegex, validOnsName } from './ons-name-regex.js'
import cors from '@fastify/cors'
import { z } from 'zod'
import { sync } from './oxen.js'
import { PurchasePromoGet } from './purchase/promo.js'
import { PurchaseCreateInvoice } from './purchase/invoice.js'
import { PurchaseCallback } from './purchase/callback.js'
import { PurchaseStatus } from './purchase/status.js'
import crypto from 'crypto'
import { getMoneySpent } from './price.js'

const __dirname = dirname(fileURLToPath(import.meta.url)) + '/'

const fastify = Fastify({
  logger: true,
  trustProxy: true
})

await fastify.register(cors, {
  origin: (origin, cb) => {
    if (!origin) {
      cb(null, 'ons.sessionbots.directory')
      return 
    }
    
    const hostname = new URL(origin).hostname
    if (hostname === 'localhost' || hostname.startsWith('192.168')) {
      cb(null, true)
      return
    }

    if (hostname === 'ons.sessionbots.directory') {
      cb(null, true)
      return
    }

    cb(null, 'ons.sessionbots.directory')
  }
})

const ons = await open({
  filename: __dirname + '../db/ons.db',
  driver: sqlite3.Database
})

fastify.get<{ Params: { name: string } }>('/session/:name', async (request, reply) => {
  const unhashedName = request.params.name.toLowerCase()
  if(!await validOnsName(unhashedName)) {
    reply.status(400).send({ ok: false, error: 'INVALID_NAME' })
    return
  }
  const hashedName = hash(unhashedName)
  const mappings = await ons.all<OnsMapping[]>('SELECT * FROM mappings WHERE name_hash = (?) AND type="session"', hashedName)
  if (!mappings.length) {
    reply.status(404).send({ ok: false, error: 'NOT_FOUND' })
  } else {
    const unhashRecord = await ons.get<OnsMapping[]>('SELECT * FROM hashes WHERE hash = (?)', hashedName)
    if (!unhashRecord) {
      ons.run('INSERT INTO hashes (hash, string) VALUES (?, ?)', hashedName, unhashedName)
    }
    reply.send({ 
      ok: true, 
      mappings: await Promise.all(
        mappings
          .sort((a, b) => b.updated_at_block - a.updated_at_block)
          .map(async mapping => {
            const sessionID = mapping.decrypted_value
            const decryptedValue = sessionID === null ? decryptONSValue(mapping.value, unhashedName) : sessionID
            if (decryptedValue) {
              ons.run('UPDATE mappings SET unhashed_name = ?, decrypted_value = ? WHERE name_hash = ?;', [
                unhashedName,
                decryptedValue,
                hashedName,
              ])
            }
            return {
              name: unhashedName,
              nameHash: hashedName,
              owner: {
                keypair: mapping.owner,
                oxen: mapping.owner_oxen,
              },
              backupOwner: {
                keypair: mapping.backup_owner,
                oxen: mapping.backup_owner_oxen
              },
              sessionId: decryptedValue,
              ...(decryptedValue === null && { sessionIdEncrypted: mapping.value }),
              transactionId: mapping.transaction_id,
              updatedAtBlock: mapping.updated_at_block,
              expiresAtBlock: mapping.expires_at_block,
              action: mapping.action,
              blockCreatedAt: mapping.block_created_at
            }
          }))
    })
  }
})

fastify.get('/list', async (request, reply) => {
  const query = await z.object({
    query: z.string()
      .min(1)
      .max(64)
      .regex(new RegExp(onsNameRegex, 'g'))
      .optional(),
    type: z.string()
      .transform(value => value.split(','))
      .optional(),
    max_block: z.coerce.number()
      .int()
      .positive()
      .optional(),
    min_block: z.coerce.number()
      .int()
      .positive()
      .optional(),
    limit: z.coerce.number()
      .int()
      .positive()
      .or(z.literal('all'))
      .optional(),
    sort_by: z.enum([
      'updatedAtBlock',
    ]).optional(),
    sort_dir: z.enum([
      'ASC',
      'DESC',
    ]).optional(),
    owner: z.string()
      .min(1)
      .max(160)
      .optional(),
    offset: z.coerce.number()
      .int()
      .min(0)
      .optional(),
  }).safeParseAsync(request.query)
  if(!query.success) {
    reply.status(400).send({ ok: false, error: 'INVALID_QUERY' })
    return
  }
  const sortBy = {
    updatedAtBlock: 'mappings.updated_at_block',
  }[query.data.sort_by ?? 'updatedAtBlock']
  const sortDir = query.data.sort_dir ?? 'DESC'
  const types = query.data.type
    ? query.data.type.filter(e => ['session', 'wallet', 'lokinet'].includes(e)) 
      .map(e => `'${e}'`)
      .join(',')
    : '\'session\''
  const filters = `
    ${query.data.query ? 'AND hashes.string LIKE :query' : ''}
    ${query.data.min_block ? 'AND mappings.updated_at_block >= :minBlock' : ''}
    ${query.data.max_block ? 'AND mappings.updated_at_block <= :maxBlock' : ''}
    ${query.data.owner 
    ? query.data.owner.length === 160
      ? 'AND (mappings.owner = :owner OR mappings.backup_owner = :owner)'
      : 'AND (mappings.owner_oxen = :owner OR mappings.backup_owner_oxen = :owner)'
    : ''}
  `
  const filtersVariables = {
    ...(query.data.query && { ':query': `%${query.data.query}%` }),
    ...(query.data.min_block && { ':minBlock': query.data.min_block }),
    ...(query.data.max_block && { ':maxBlock': query.data.max_block }),
    ...(query.data.owner && { ':owner': query.data.owner }),
  }
  const mappings = await ons.all<OnsMapping[]>(`
    SELECT mappings.*, hashes.string AS name
    FROM mappings
    LEFT JOIN hashes ON mappings.name_hash = hashes.hash
    WHERE mappings.type IN (${types})
    ${filters}
    ORDER BY ${sortBy} ${sortDir}
    ${query.data.limit !== 'all' ? 'LIMIT (:limit) OFFSET (:offset)' : ''}
  `, {
    ...(query.data.limit !== 'all' && {
      ':limit': query.data.limit ?? 100,
      ':offset': query.data.offset ?? 0,
    }),
    ...filtersVariables
  })
  const onsRecords = await Promise.all(mappings.map(mapOnsRecord))
  const total = await ons.get<{ 'COUNT(*)': number }>(`
    SELECT COUNT(*)
    FROM mappings
    LEFT JOIN hashes ON mappings.name_hash = hashes.hash
    WHERE mappings.type IN (${types})
    ${filters}
  `, {
    ...filtersVariables
  })

  const response = {
    ok: true,
    mappings: onsRecords,
    total: total?.['COUNT(*)'] ?? 0,
  }

  const etag = `"${crypto.createHash('sha256').update(JSON.stringify(response)).digest('hex')}"`

  if(query.data.limit === 'all') {
    if(request.headers['if-none-match'] === etag) {
      reply.status(304).send()
      return
    } else {
      reply.header('ETag', etag)
    }
  }

  reply.send(response)
})

const mapOnsRecord = async (mapping: OnsMapping) => {
  const unhashedName = mapping.unhashed_name
  const sessionID = unhashedName ? mapping.decrypted_value : null
  return {
    name: unhashedName,
    type: mapping.type,
    nameHash: mapping.name_hash,
    owner: {
      keypair: mapping.owner,
      oxen: mapping.owner_oxen,
    },
    backupOwner: {
      keypair: mapping.backup_owner,
      oxen: mapping.backup_owner_oxen
    },
    sessionId: unhashedName ? sessionID : null,
    sessionIdEncrypted: mapping.value,
    transactionId: mapping.transaction_id,
    updatedAtBlock: mapping.updated_at_block,
    expiresAtBlock: mapping.expires_at_block,
    action: mapping.action,
    blockCreatedAt: mapping.block_created_at
  }
}

fastify.get('/cost', async (request, reply) => {
  const query = await z.object({
    owner: z.string()
      .min(1)
      .max(160),
    fiat: z.enum(['rub', 'usd']),
  }).safeParseAsync(request.query)
  if (!query.success) {
    reply.status(400).send({ ok: false, error: 'INVALID_QUERY' })
    return
  }

  const amount = await getMoneySpent(query.data.fiat, query.data.owner)
  reply.send({ ok: true, amount })
})

fastify.get('/purchase/promo/:name', PurchasePromoGet)
fastify.post('/purchase/invoice', PurchaseCreateInvoice)
fastify.post('/purchase/callback', PurchaseCallback)
fastify.get('/purchase/status', PurchaseStatus)
fastify.get('/ip8721379812783', (request, reply) => reply.send(request.ip))

fastify.listen({ port: 6801 }, (err, address) => {
  if (err) throw err
  console.log(`Server listening on ${address}`)
})

async function scheduleAutosync() {
  await sync()
  await new Promise(resolve => setTimeout(resolve, 1000 * 60 * 1))
  scheduleAutosync()
}

scheduleAutosync()

export { ons }