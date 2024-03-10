import './env.js'
import Fastify from 'fastify'
import { createIdentity, getSessionID, initializeSession, sendMessage } from 'session-messenger-nodejs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url)) + '/'

const fastify = Fastify({ logger: true })
await initializeSession({
  profileDataPath: __dirname + '../session-data'
})
try {
  await getSessionID()
} catch(e) {
  if (e.message === 'User is not authorized') {
    await createIdentity('ons.sessionbots.directory (do not reply)')
  } else {
    throw e
  }
}

fastify.post('/receipt', {
  schema: {
    body: {
      type: 'object',
      properties: {
        sessionID: { type: 'string' },
        text: { type: 'string' }
      }
    }
  },
  handler: async function handler(request, reply) {
    const body = request.body as {
      sessionID: string
      text: string
    }
    try {
      await sendMessage(body.sessionID, {
        body: body.text
      })
      return { ok: true }
    } catch(e) {
      return { ok: false, error: e.message }
    }
  }
})

try {
  await fastify.listen({ port: 6803 })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}