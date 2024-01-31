import { FastifyReply, FastifyRequest } from 'fastify'
import Decimal from 'decimal.js'
import { purchases } from './db.js'

type Coupon = {
  name: string
  uses: number
  left: number
  created_at: number
  expires_at?: number
  discount_percent?: number
  discount_amount_in_rub?: number
  discount_amount_in_usd?: number
}

const rateLimits = new Map<string, number[]>()
export async function PurchasePromoGet(request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) {
  const requestsByIp = rateLimits.get(request.ip) ?? []
  if (requestsByIp.length && requestsByIp.length >= 40 && (Date.now() - requestsByIp.slice(-10)[0]) < 1000 * 60 * 60) {
    reply.code(429).send({ ok: false, error: 'RATE_LIMITED', retryAfter: Math.ceil((1000 * 60 * 60 - (Date.now() - requestsByIp.slice(-10)[0])) / 1000) })
    return
  } else {
    rateLimits.set(request.ip, requestsByIp.concat(Date.now()))
  }

  const price = await calculatePriceWithCoupon(request.params.name)
  if(price === null) {
    reply.code(404).send({ ok: false, error: 'NOT_FOUND' })
  } else {
    reply.code(200).send({ ok: true, price: { rub: price.rub.toString(), usd: price.usd.toString() } })
  }
}

export const basePrice = {
  rub: '450.00',
  usd: '5.00'
}

export async function calculatePriceWithCoupon(code: string): Promise<{ rub: Decimal, usd: Decimal } | null>{
  const result = await purchases.get<Coupon>('SELECT * FROM coupons WHERE name = (?) AND left > 0', code)
  if (result && (result.expires_at ? result.expires_at >= Date.now() : true) && result.left > 0) {
    if(result.discount_percent && result.discount_percent <= 1) {
      const calc = (base) => new Decimal(base).mul(new Decimal(1).minus(result.discount_percent as number))
      return { rub: calc(basePrice.rub), usd: calc(basePrice.usd) }
    } else if(result.discount_amount_in_rub && result.discount_amount_in_usd) {
      return { 
        rub: new Decimal(basePrice.rub).minus(result.discount_amount_in_rub).clamp(0, basePrice.rub),
        usd: new Decimal(basePrice.usd).minus(result.discount_amount_in_usd).clamp(0, basePrice.usd),
      }
    } else {
      return null
    }
  } else {
    return null
  }
}