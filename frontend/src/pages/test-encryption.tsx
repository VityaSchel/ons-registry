import React from 'react'
import { decryptONSValue } from '@/shared/encryption'

export default function TestEncryption() {
  const [input, setInput] = React.useState('')

  const handleDecrypt = () => {
    const [value, unhashedName] = input.split(',')
    alert(decryptONSValue(value, unhashedName))
  }

  return (
    <div className='p-10 mb-10 flex flex-col gap-2'>
      <input className='p-2 rounded-md' value={input} onChange={e => setInput(e.target.value)} />
      <button className='bg-white text-black px-2 font-medium rounded-md' onClick={handleDecrypt}>Decrypt</button>
    </div>
  )
}