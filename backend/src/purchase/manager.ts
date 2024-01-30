import { purchases } from './db.js'
import { spawn } from 'child_process'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { glob } from 'glob'
import fs from 'fs/promises'
import _ from 'lodash'
import tcpPortUsed from 'tcp-port-used'

const __dirname = dirname(fileURLToPath(import.meta.url)) + '/'

if (!process.env.TELEGRAM_BOT_API_TOKEN) throw new Error('TELEGRAM_BOT_API_TOKEN not set')
if (!process.env.TELEGRAM_CHAT_ID) throw new Error('TELEGRAM_CHAT_ID not set')

async function sendNotificationToAdmin(text: string) {
  await fetch('https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_API_TOKEN + '/sendMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text
    })
  })
}

export async function sendItem(invoiceUUID: string, name: string, sessionID: string, email?: string) {
  await purchases.run('UPDATE invoices SET status = "processing" WHERE uuid = ?', invoiceUUID)  

  const walletDir = __dirname + '../.oxen/'
  const wallets = await glob(walletDir + 'wallet-*')
  
  if (wallets.length === 0) {
    console.log('==[ ${name} ]==: No oxen wallets available')
    await purchases.run('UPDATE invoices SET status = "errored" WHERE uuid = ?', invoiceUUID)  
    await sendNotificationToAdmin(`⚠️ PURCHASE FAILED: NO WALLETS LEFT ⚠️ ${name} (${sessionID}) invId: ${invoiceUUID}`)
    return
  } else {
    sendNotificationToAdmin(`ONS name purchase: ${name} (${sessionID}), wallets left: ${wallets.length} | invId: ${invoiceUUID}`)
  }
  const wallet = _.sample(wallets)  
  await fs.rename(walletDir + wallet, walletDir + 'used_' + wallet)

  const ports = new Array(99).fill(null).map((_, i) => i + 6900)
  let walletPort: number | undefined
  for(const port of ports) {
    if (await tcpPortUsed.check(port)) {
      walletPort = port
      break
    }
  }
  if(!walletPort) {
    console.log('==[ ${name} ]==: No available ports')
    await purchases.run('UPDATE invoices SET status = "errored" WHERE uuid = ?', invoiceUUID)  
    await sendNotificationToAdmin(`⚠️ PURCHASE FAILED: NO AVAILABLE PORTS ⚠️ ${name} (${sessionID}) invId: ${invoiceUUID}`)
    return
  }

  console.log(`Sending item to ${name} (${sessionID})`)
  console.log('==[ ${name} ]==: Spawning oxen wallet', wallet, 'on port', walletPort)
  
  try {
    const walletCli = spawn(__dirname + '../oxen/oxen-wallet-rpc', [
      '--daemon-address', 'public-eu.optf.ngo:22023',
      '--wallet-file', walletDir + wallet,
      '--password', 'onsregistry',
      '--trusted-daemon', 
      '--rpc-bind-port', String(walletPort),
      '--rpc-login', 'onsregistry:onsregistry'
    ])
    walletCli.stderr.on('data', (data) => {
      console.error('==[ ${name} ]==: oxen wallet stderr:', data.toString())
    })

    const request = await fetch(`http://127.0.0.1:${walletPort}/json_rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        'jsonrpc': '2.0', 
        'id': 0, 
        'method': 'ons_buy_mapping', 
        'params': { 
          'name': name,
          'type': 'session',
          'value': sessionID,
          'priority': 0, 
          'get_tx_hex': true 
        } 
      })
    })
    const response = await request.json() as { error: { code: number, message: string } } | { result: object }
    if ('error' in response) {
      console.error('==[ ${name} ]==: Error while buying item:', response.error.message)
      await purchases.run('UPDATE invoices SET status = "errored" WHERE uuid = ?', invoiceUUID)
      await sendNotificationToAdmin(`⚠️ PURCHASE FAILED (${response.error.message}): ${name} (${sessionID}) invId: ${invoiceUUID}`)  
      return
    } else {
      console.log('==[ ${name} ]==: Successfully bought mapping:', response.result)
      await purchases.run('UPDATE invoices SET status = "success" WHERE uuid = ?', invoiceUUID)
      // send email to [email]
    }
  } catch(e) {
    console.error('==[ ${name} ]==: Error while running oxen-wallet:', e)
    await purchases.run('UPDATE invoices SET status = "errored" WHERE uuid = ?', invoiceUUID)  
    await sendNotificationToAdmin(`⚠️ PURCHASE FAILED (${e.message}): ${name} (${sessionID}) invId: ${invoiceUUID}`)
    return
  }

  await purchases.run('UPDATE invoices SET status = "success" WHERE uuid = ?', invoiceUUID)
  await purchases.run('UPDATE invoices SET status = "error" WHERE uuid = ?', invoiceUUID)
}