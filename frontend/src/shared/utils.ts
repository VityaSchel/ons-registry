import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function blockToDate(block: number) {
  const dateOf650kBlock = new Date('2020-10-24T10:42:00.000Z')
  if (block < 650000) {
    return null
  } else {
    return new Date(dateOf650kBlock.getTime() + (block - 650000) * 120 * 1000)
  }
}

const byteToHex: string[] = []
for (let n = 0; n <= 0xff; ++n) {
  const hexOctet = n.toString(16).padStart(2, '0')
  byteToHex.push(hexOctet)
}
export function uint8ArrayToHex(arrayBuffer: Uint8Array) {
  const buff = new Uint8Array(arrayBuffer)
  const hexOctets = []

  for (let i = 0; i < buff.length; ++i)
    hexOctets.push(byteToHex[buff[i]])

  return hexOctets.join('')
}

export async function uint8arrayToBase64(input: Uint8Array) {
  // use a FileReader to generate a base64 data URI:
  const base64url = await new Promise<string>(resolve => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(new Blob([input]))
  })
  // remove the `data:...;base64,` part from the start
  return base64url.slice(base64url.indexOf(',') + 1)
}