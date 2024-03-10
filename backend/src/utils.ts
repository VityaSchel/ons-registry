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

export function blockToTimestamp(block: number): number {
  const dateOf650kBlock = new Date('2020-10-24T10:42:00.000Z')
  if (block < 650000) {
    console.error('blockToTimestamp: block is less than 650000', block)
    return 0
  } else {
    return Math.floor(new Date(dateOf650kBlock.getTime() + (block - 650000) * 120 * 1000).getTime() / 1000)
  }
}