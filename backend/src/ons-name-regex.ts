import { z } from 'zod'

export const onsNameRegex = '^\\w([\\w-]*[\\w])?$'

export async function validOnsName(name: string) {
  const result = await z.string()
    .min(1)
    .max(64)
    .regex(new RegExp(onsNameRegex, 'g'))
    .safeParseAsync(name)
  return result.success
}