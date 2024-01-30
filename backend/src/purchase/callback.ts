import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { purchases } from './db.js'
import ipRangeCheck from 'ip-range-check'
import { sendItem } from './manager.js'
import { Invoice } from './invoice.js'

const callbackIpRanges = [
  '185.71.76.0/27',
  '185.71.77.0/27',
  '77.75.153.0/25',
  '77.75.156.11',
  '77.75.156.35',
  '77.75.154.128/25',
  '2a02:5180::/32',
]

export async function PurchaseCallback(request: FastifyRequest, reply: FastifyReply) {
  if (!ipRangeCheck(request.ip, callbackIpRanges)) {
    reply.code(403).send({ ok: false, error: 'FORBIDDEN_IP' })
    return
  }

  const body = await z.object({
    event: z.string(),
    object: z.object({
      id: z.string(),
      metadata: z.object({
        invoiceUUID: z.string()
      })
    })
  }).safeParseAsync(request.body)

  if (!body.success) {
    reply.code(400).send({ ok: false, error: 'BAD_REQUEST' })
    return
  }

  reply.code(200).send({ ok: true })

  if (body.data.event === 'payment.succeeded') {
    const invoiceUUID = body.data.object.metadata.invoiceUUID
    const invoice = await purchases.get<Invoice>('SELECT * FROM invoices WHERE uuid = ?', invoiceUUID)
    if (!invoice || invoice.status !== 'created') {
      return
    }
    sendItem(invoiceUUID, invoice.name, invoice.session_id, invoice.email)
  } else if (body.data.event === 'payment.canceled') {
    const invoiceUUID = body.data.object.metadata.invoiceUUID
    const invoice = await purchases.get<Invoice>('SELECT * FROM invoices WHERE uuid = ?', invoiceUUID)
    if (invoice) {
      await purchases.run('UPDATE invoices SET status = "canceled" WHERE uuid = ?', invoiceUUID)
      if (invoice.coupon) {
        await purchases.run('UPDATE coupons SET uses = uses - 1, left = left + 1 WHERE name = ? AND left > 0', invoice.coupon)
      }
    }
  } else {
    reply.code(200).send({ ok: true })
    console.error('Unknown event', body.data.event)
  }
}