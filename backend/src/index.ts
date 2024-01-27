import Fastify from 'fastify'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { hash } from '@/encrytion.js'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url)) + '/'

const fastify = Fastify({
  logger: true
})

const ons = await open({
  filename: __dirname + '../db/ons.db',
  driver: sqlite3.Database
})

fastify.get<{ Params: { name: string } }>('/session/:name', async (request, reply) => {
  const hashedName = hash(request.params.name)
  const mapping = await ons.get('SELECT * FROM mappings WHERE name_hash = (?) AND type="session"', hashedName)
  if (!mapping) {
    reply.status(404).send({ ok: false, error: 'not-found' })
  } else {
    reply.send(mapping)
  }
})

fastify.listen({ port: 6801 }, (err, address) => {
  if (err) throw err
})

export { ons }