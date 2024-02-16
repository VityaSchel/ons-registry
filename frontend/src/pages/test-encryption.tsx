import React from 'react'
// import { decryptONSValue } from '@/shared/encryption'

export default function TestEncryption() {
  const [input, setInput] = React.useState('d64810775560bc508df1515851447b8342aa20e2cd039a978190243a7f8d88f56773206a3f28becb80eb8e16f2d630128c,josh')

  const handleDecrypt = async () => {
    // const [value, unhashedName] = input.split(',')
    // console.log('result decrypted', await decryptONSValue(value, unhashedName))
    // console.timeEnd('startEncrypting')
    const sw = navigator.serviceWorker.controller
    if(!sw) return console.error('Service Worker not ready')
    sw.postMessage({ type: 'hash', plain: input })
    const subscription = (event: MessageEvent) => {
      if (typeof event.data === 'object' && event.data.type === 'hash_result' && 'hash' in event.data) {
        console.log('hash_result', event.data.hash)
        self.removeEventListener('message', subscription)
      }
    }
    self.addEventListener('message', subscription)
  }

  return (
    <div className='p-10 mb-10 flex flex-col gap-2'>
      <input className='p-2 rounded-md' value={input} onChange={e => setInput(e.target.value)} />
      <button className='bg-white text-black px-2 font-medium rounded-md' onClick={handleDecrypt}>Decrypt</button>
    </div>
  )
}