import { ons } from './index.js'

export async function unhash(hash: string): Promise<string | null> {
  const unhashed = await ons.get<{ hash: string, string: string }>('SELECT * FROM hashes WHERE hash = (?)', hash)
  if (unhashed) {
    return unhashed.string
  } else {
    return null
  }
}