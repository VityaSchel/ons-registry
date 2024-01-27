import { z } from 'zod'

export async function validOnsName(name: string) {
  const result = await z.string()
    .min(1)
    .max(64)
    .regex(new RegExp('^\\w([\\w-]*[\\w])?$', 'g'))
    .safeParseAsync(name)
  return result.success
}