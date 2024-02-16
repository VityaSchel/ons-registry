import blake2 from 'blake2b'

export async function hash(input: string) {
  const enc = new TextEncoder()
  return await uint8arrayToBase64(blake2(32)
    .update(enc.encode(input))
    .digest('binary'))
}

async function uint8arrayToBase64(input: Uint8Array) {
  // use a FileReader to generate a base64 data URI:
  const base64url = await new Promise<string>(resolve => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(new Blob([input]))
  })
  // remove the `data:...;base64,` part from the start
  return base64url.slice(base64url.indexOf(',') + 1)
}