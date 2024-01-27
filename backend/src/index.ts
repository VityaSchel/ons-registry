import Fastify from 'fastify'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { decryptONSValue, dehash, hash } from './encrytion.js'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { OnsMapping } from './schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url)) + '/'

const fastify = Fastify({
  logger: true
})

const ons = await open({
  filename: __dirname + '../db/ons.db',
  driver: sqlite3.Database
})

fastify.get<{ Params: { name: string } }>('/session/:name', async (request, reply) => {
  const unhashedName = request.params.name
  const hashedName = hash(unhashedName)
  const mappings = await ons.all<OnsMapping[]>('SELECT * FROM mappings WHERE name_hash = (?) AND type="session"', hashedName)
  if (!mappings.length) {
    reply.status(404).send({ ok: false, error: 'not-found' })
  } else {
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
    await Promise.all(mappings.map(async mapping => {
      const unhashedName = await dehash(mapping.name_hash)
      return {
        name: unhashedName,
        ...(unhashedName === null && { nameHash: mapping.name_hash }),
        backupOwner: mapping.backup_owner,
        sessionID: unhashedName ? decryptONSValue(mapping.value, unhashedName) : null,
        ...(unhashedName === null && { sessionIdEncrypted: mapping.value }),
        transactionId: mapping.transaction_id,
        updatedAtBlock: mapping.updated_at_block,
        expiresAtBlock: mapping.expires_at_block,
        action: mapping.action,
      }
    }))
  )
})

fastify.get('/list', async (request, reply) => {
  const mappings = await ons.all<OnsMapping[]>(`
    SELECT mappings.*, hashes.string AS name
    FROM mappings
    LEFT JOIN hashes ON mappings.name_hash = hashes.hash;
  `)
  reply.send(mappings)
})

fastify.listen({ port: 6801 }, (err, address) => {
  if (err) throw err
  console.log(`Server listening on ${address}`)
})

export { ons }