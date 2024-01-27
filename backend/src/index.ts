import Fastify from 'fastify'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { decryptONSValue, unhash, hash } from './encrytion.js'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { OnsMapping } from './schema.js'
import { onsNameRegex, validOnsName } from './ons-name-regex.js'
import cors from '@fastify/cors'
import { z } from 'zod'

const __dirname = dirname(fileURLToPath(import.meta.url)) + '/'

const fastify = Fastify({
  logger: true
})

await fastify.register(cors, {
  origin: ['http://localhost:8777']
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
      await ons.run('INSERT INTO hashes (hash, string) VALUES (?, ?)', hashedName, unhashedName)
    }
    reply.send(
      mappings.map(mapping => ({
        owner: mapping.owner,
        backupOwner: mapping.backup_owner,
        sessionID: decryptONSValue(mapping.value, unhashedName),
        transactionId: mapping.transaction_id,
        updatedAtBlock: mapping.updated_at_block,
        expiresAtBlock: mapping.expires_at_block,
        action: mapping.action,
      }))
    )
  }
})

fastify.get<{ Params: { owner: string } }>('/owner/:owner', async (request, reply) => {
  const owner = request.params.owner
  const mappings = await ons.all<OnsMapping[]>('SELECT * FROM mappings WHERE owner = (?)', owner)
  reply.send(
    await Promise.all(mappings.map(mapOnsRecord))
  )
})

fastify.get('/list', async (request, reply) => {
  const query = await z.object({
    query: z.string()
      .min(1)
      .max(64)
      .regex(new RegExp(onsNameRegex, 'g'))
      .optional(),
    maxBlock: z.coerce.number()
      .int()
      .positive()
      .optional(),
    minBlock: z.coerce.number()
      .int()
      .positive()
      .optional(),
    limit: z.coerce.number()
      .int()
      .positive()
      .optional(),
  }).safeParse(request.query)
  if(!query.success) {
    reply.status(400).send({ ok: false, error: 'INVALID_QUERY' })
    return
  }
  const mappings = await ons.all<OnsMapping[]>(`
    SELECT mappings.*, hashes.string AS name
    FROM mappings
    LEFT JOIN hashes ON mappings.name_hash = hashes.hash
    ${query.data.query ? 'WHERE hashes.string LIKE :query' : ''}
    LIMIT (:limit)
  `, {
    ':limit': query.data.limit ?? 100,
    ...(query.data.query && { ':query': `%${query.data.query}%` }),
  })
  reply.send(
    await Promise.all(mappings.map(mapOnsRecord))
  )
})

const mapOnsRecord = async (mapping: OnsMapping) => {
  const unhashedName = await unhash(mapping.name_hash)
  const sessionID = unhashedName ? decryptONSValue(mapping.value, unhashedName) : null
  return {
    name: unhashedName,
    ...(unhashedName === null && { nameHash: mapping.name_hash }),
    owner: mapping.owner,
    backupOwner: mapping.backup_owner,
    sessionId: unhashedName ? sessionID : null,
    ...((unhashedName === null || sessionID === null) && { sessionIdEncrypted: mapping.value }),
    transactionId: mapping.transaction_id,
    updatedAtBlock: mapping.updated_at_block,
    expiresAtBlock: mapping.expires_at_block,
    action: mapping.action,
  }
}

fastify.listen({ port: 6801 }, (err, address) => {
  if (err) throw err
  console.log(`Server listening on ${address}`)
})

export { ons }