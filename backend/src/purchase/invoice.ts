import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { onsNameRegex } from '../ons-name-regex.js'
import { basePrice, calculatePriceWithCoupon } from './promo.js'
import basicAuth from 'basic-authorization-header'
import { randomUUID } from 'crypto'
import Decimal from 'decimal.js'
import { purchases } from './db.js'
import { sendItem } from './manager.js'
import { ons } from '../index.js'

export type Invoice = {
  uuid: string
  name: string
  session_id: string
  coupon: string | null
  currency: 'rub' | 'usd'
  price: string
  created_at: number
  status: 'created' | 'processing' | 'canceled' | 'success' | 'errored'
}

const rateLimitsCreation = new Map<string, number[]>()
export async function PurchaseCreateInvoice(request: FastifyRequest, reply: FastifyReply) {
  if (!process.env.YOOKASSA_API_TOKEN) throw new Error('YOOKASSA_API_TOKEN is not set')

  const body = await z.object({
    name: z.string()
      .min(1)
      .max(64)
      .regex(new RegExp(onsNameRegex, 'g')),
    sessionID: z.string()
      .length(66)
      .regex(/^[a-z0-9]+$/),
    coupon: z.string()
      .min(1)
      .max(100)
      .optional(),
    currency: z.enum(['rub', 'usd'])
  }).safeParseAsync(request.body)
  if (!body.success) {
    return reply.status(400).send({ ok: false, error: 'INVALID_BODY' })
  }

  const rateLimit = rateLimitsCreation.get(request.ip) ?? []
  if (rateLimit.length && rateLimit.length >= 20 && (Date.now() - rateLimit.slice(-5)[0]) < 1000 * 60 * 60) {
    return reply.status(429).send({ ok: false, error: 'RATE_LIMITED', retryAfter: Math.ceil((1000 * 60 * 60 - (Date.now() - rateLimit.slice(-5)[0])) / 1000) })
  }

  if(
    await ons.get('SELECT name FROM mappings WHERE name = ?', body.data.name) ||
    await purchases.get('SELECT name FROM invoices WHERE name = ? AND status != "canceled"', body.data.name)
  ) {
    return reply.status(409).send({ ok: false, error: 'NAME_OCCUPIED' })
  }

  let price = basePrice
  if(body.data.coupon) {
    const newPrice = await calculatePriceWithCoupon(body.data.coupon)
    if(newPrice !== null) {
      price = {
        rub: newPrice.rub.toFixed(2),
        usd: newPrice.usd.toFixed(2)
      }
      await purchases.run('UPDATE coupons SET uses = ISNULL(uses, 0) + 1, left = left - 1 WHERE name = ? AND left > 0', body.data.coupon)
    }
  }

  const invoiceUUID = randomUUID()
  await purchases.run('INSERT INTO invoices (uuid, name, session_id, coupon, currency, price, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', invoiceUUID, body.data.name, body.data.sessionID, body.data.coupon ?? null, body.data.currency, price[body.data.currency], Date.now(), 'created')
  const redirectUrl = `https://ons.sessionbots.directory/purchase-processing?invoice=${invoiceUUID}`

  if(new Decimal(price[body.data.currency]).eq(0)) {
    await sendItem(invoiceUUID, body.data.name, body.data.sessionID)
    return reply.send({ 
      ok: true, 
      redirect: redirectUrl
    })
  }

  const paymentRequest = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': basicAuth(process.env.YOOKASSA_SHOP_ID, process.env.YOOKASSA_API_TOKEN),
      'Idempotence-Key': randomUUID()
    },
    body: JSON.stringify({
      amount: {
        value: price[body.data.currency],
        currency: body.data.currency.toUpperCase()
      },
      description: `Покупка никнейма ${body.data.name}`,
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: redirectUrl
      },
      metadata: {
        invoiceUUID
      }
    })
  })
  if(paymentRequest.status !== 200) {
    console.log(await paymentRequest.text())
    reply.status(500).send({ ok: false, error: 'INTERNAL_SERVER_ERROR' })
    return
  }
  const paymentResponse = await paymentRequest.json() as { id: string, confirmation: { confirmation_url: string } }
  
  return reply.send({ ok: true, redirect: paymentResponse.confirmation.confirmation_url })
}