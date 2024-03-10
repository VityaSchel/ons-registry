import './env.js'
import Fastify from 'fastify'
const fastify = Fastify({ logger: true })

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
    try {
      
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