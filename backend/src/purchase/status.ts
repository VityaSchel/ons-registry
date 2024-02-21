import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { purchases } from './db.js'

export type Invoice = {
  uuid: string
  name: string
  session_id: string
  coupon: string | null
  currency: 'rub' | 'usd'
  price: string
  created_at: number
  owner?: string
  status: 'created' | 'processing' | 'canceled' | 'success' | 'errored'
}

export async function PurchaseStatus(request: FastifyRequest, reply: FastifyReply) {
  const query = await z.object({
    invoice: z.string()
      .uuid()
  }).safeParseAsync(request.query)
  if (!query.success) {
    return reply.status(400).send({ ok: false, error: 'INVALID_QUERY' })
  }

  const invoice = await purchases.get<Pick<Invoice, 'status'>>('SELECT status FROM invoices WHERE uuid = ?', query.data.invoice)
  if(invoice) {
    return reply.send({ ok: true, status: invoice.status })
  } else {
    return reply.code(404).send({ ok: false, error: 'NOT_FOUND' })
  }
}