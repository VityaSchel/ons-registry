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
import { sync } from './oxen.js'

const __dirname = dirname(fileURLToPath(import.meta.url)) + '/'

const fastify = Fastify({
  logger: true
})

await fastify.register(cors, {
  origin: ['http://localhost:8777', 'https://ons.sessionbots.directory']
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
      mappings.map(mapping => {
        const sessionID = decryptONSValue(mapping.value, unhashedName)
        return {
          name: unhashedName,
          owner: mapping.owner,
          backupOwner: mapping.backup_owner,
          sessionId: sessionID,
          ...(sessionID && { sessionIdEncrypted: mapping.value }),
          transactionId: mapping.transaction_id,
          updatedAtBlock: mapping.updated_at_block,
          expiresAtBlock: mapping.expires_at_block,
          action: mapping.action,
        }
      })
    )
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
      .optional(),
    sort_by: z.enum([
      'updatedAtBlock',
    ]).optional(),
    sort_dir: z.enum([
      'ASC',
      'DESC',
    ]).optional(),
    owner: z.string()
      .optional(),
  }).safeParse(request.query)
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
    : '\'session\',\'wallet\',\'lokinet\''
  const filters = `
    ${query.data.query ? 'AND hashes.string LIKE :query' : ''}
    ${query.data.min_block ? 'AND mappings.updated_at_block >= :minBlock' : ''}
    ${query.data.max_block ? 'AND mappings.updated_at_block <= :maxBlock' : ''}
    ${query.data.owner ? 'AND mappings.owner = :owner' : ''}
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
    LIMIT (:limit)
  `, {
    ':limit': query.data.limit ?? 100,
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

  reply.send({
    ok: true,
    mappings: onsRecords,
    total: total?.['COUNT(*)'] ?? 0,
  })
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
    ...(sessionID === null && { sessionIdEncrypted: mapping.value }),
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

async function scheduleAutosync() {
  await sync()
  await new Promise(resolve => setTimeout(resolve, 1000 * 60 * 2))
  scheduleAutosync()
}

scheduleAutosync()

export { ons }