import { Db } from './model.js'

export async function unhash(hash: string, ons?: Db): Promise<string | null> {
  if(!ons) {
    ons = (await import('./index.js')).ons
  }
  const unhashed = await ons.get<{ hash: string, string: string }>('SELECT * FROM hashes WHERE hash = (?)', hash)
  if (unhashed) {
    return unhashed.string
  } else {
    return null
  }
}