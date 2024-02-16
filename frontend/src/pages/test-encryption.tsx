import React from 'react'
import { decryptONSValue } from '@/shared/encryption'

export default function TestEncryption() {
  const [input, setInput] = React.useState('d64810775560bc508df1515851447b8342aa20e2cd039a978190243a7f8d88f56773206a3f28becb80eb8e16f2d630128c,josh')

  const handleDecrypt = async () => {
    const [value, unhashedName] = input.split(',')
    console.log('result decrypted', await decryptONSValue(value, unhashedName))
  }

  return (
    <div className='p-10 mb-10 flex flex-col gap-2'>
      <input className='p-2 rounded-md' value={input} onChange={e => setInput(e.target.value)} />
      <button className='bg-white text-black px-2 font-medium rounded-md' onClick={handleDecrypt}>Decrypt</button>
    </div>
  )
}