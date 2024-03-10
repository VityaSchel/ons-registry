import { purchases } from './db.js'
import { spawn } from 'child_process'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { glob } from 'glob'
import fs from 'fs/promises'
import _ from 'lodash'
import tcpPortUsed from 'tcp-port-used'
import path from 'path'
import basicAuth from 'basic-authorization-header'
import { sendReceiptToSession } from '../session-receipts.js'

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

export async function sendItem(invoiceUUID: string, name: string, sessionID: string, language: 'ru' | 'en', walletInfo: { owner?: string }, dryRun = false) {
  await purchases.run('UPDATE invoices SET status = "processing" WHERE uuid = ?', invoiceUUID)  

  const walletDir = __dirname + '../../.oxen/'
  const wallets = await glob(walletDir + 'wallet-*.keys')
  
  if (wallets.length === 0) {
    console.log(`==[ ${name} ]==: No oxen wallets available`)
    await purchases.run('UPDATE invoices SET status = "errored" WHERE uuid = ?', invoiceUUID)  
    await sendNotificationToAdmin(`⚠️ PURCHASE FAILED: NO WALLETS LEFT ⚠️ ${name} (${sessionID}) invId: ${invoiceUUID}`)
    return
  } else {
    sendNotificationToAdmin(`ONS name purchase: ${name} (${sessionID}, owner ${walletInfo.owner || '[not specified]'}), wallets left: ${wallets.length - 1} | invId: ${invoiceUUID}`)
  }
  let wallet = path.basename(_.sample(wallets) as string).slice(0, -'.keys'.length)
  if (!dryRun) {
    await Promise.all([
      fs.rename(walletDir + wallet, walletDir + 'used_' + wallet),
      fs.rename(walletDir + wallet + '.keys', walletDir + 'used_' + wallet + '.keys')
    ])
    wallet = 'used_' + wallet
  }


  const ports = new Array(99).fill(null).map((_, i) => i + 6900)
  let walletPort: number | undefined
  for(const port of ports) {
    if (!await tcpPortUsed.check(port)) {
      walletPort = port
      break
    }
  }
  if(!walletPort) {
    console.log(`==[ ${name} ]==: No available ports`)
    await purchases.run('UPDATE invoices SET status = "errored" WHERE uuid = ?', invoiceUUID)  
    await sendNotificationToAdmin(`⚠️ PURCHASE FAILED: NO AVAILABLE PORTS ⚠️ ${name} (${sessionID}) invId: ${invoiceUUID}`)
    return
  }

  console.log(`Sending item to ${name} (${sessionID})`)
  console.log(`==[ ${name} ]==: Spawning oxen wallet`, wallet, 'on port', walletPort)
  
  try {
    const walletCli = spawn(__dirname + '../../oxen/oxen-wallet-rpc', [
      '--daemon-address', 'public-eu.optf.ngo:22023',
      '--wallet-file', walletDir + wallet,
      '--password', 'onsregistry',
      '--trusted-daemon', 
      '--rpc-bind-port', String(walletPort),
      '--rpc-login', 'onsregistry:onsregistry'
    ])
    walletCli.stderr.on('data', (data) => {
      console.error(`==[ ${name} ]==: oxen wallet stderr:`, data.toString())
    })
    await new Promise<void>(resolve => {
      walletCli.stdout.on('data', (data) => {
        console.log(`==[ ${name} ]==: oxen wallet stdout:`, data.toString())
        if (data.toString().includes('Starting wallet RPC server')) resolve()
      })
    })
    console.log(`==[ ${name} ]==: Connecting to wallet via RPC`)

    let mnemonic = ''
    if(!walletInfo.owner) {
      const mnemonicRequest = await fetch(`http://127.0.0.1:${walletPort}/json_rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': basicAuth('onsregistry', 'onsregistry')
        },
        body: JSON.stringify({ 
          'jsonrpc': '2.0', 
          'id': 0, 
          'method': 'query_key', 
          'params': { 
            'key_type': 'mnemonic'
          } 
        })
      })
      const mnemonicResponse = await parseJSONResponse<{ result: { key: string } }>(mnemonicRequest)
      mnemonic = mnemonicResponse.result.key
      if(!mnemonic) {
        walletCli.kill('SIGINT')
        throw new Error('No mnemonic in response')
      }
    }

    type BuyResponse = { error: { code: number, message: string } } | { result: { tx_hash: string } }
    let buyResponse: BuyResponse | undefined = undefined
    if (!dryRun) {
      const buyRequest = await fetch(`http://127.0.0.1:${walletPort}/json_rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': basicAuth('onsregistry', 'onsregistry')
        },
        body: JSON.stringify({ 
          'jsonrpc': '2.0', 
          'id': 0, 
          'method': 'ons_buy_mapping', 
          'params': { 
            'name': name,
            'type': 'session',
            ...(walletInfo.owner && { 'owner': walletInfo.owner }),
            'value': sessionID,
            'priority': 0, 
            'get_tx_hex': true 
          } 
        })
      })
      buyResponse = await parseJSONResponse<BuyResponse>(buyRequest)
      if ('error' in buyResponse) {
        console.error(`==[ ${name} ]==: Error while buying item:`, buyResponse.error.message)
        await purchases.run('UPDATE invoices SET status = "errored" WHERE uuid = ?', invoiceUUID)
        await sendNotificationToAdmin(`⚠️ PURCHASE FAILED (${buyResponse.error.message}): ${name} (${sessionID}) invId: ${invoiceUUID}`)  
        return
      }
      console.log(`==[ ${name} ]==: Successfully bought mapping:`, buyResponse.result)
    } else {
      console.log(`==[ ${name} ]==: Successfully bought mapping (dry run)`)
    }
    
    await purchases.run('UPDATE invoices SET status = "success" WHERE uuid = ?', invoiceUUID)
    if(!walletInfo.owner) {
      console.log(`==[ ${name} ]==: Sending receipt + seed pharse to ${sessionID} on ${language} language`)
    } else {
      console.log(`==[ ${name} ]==: Sending only receipt to ${sessionID} on ${language} language`)
    }
    if (buyResponse) {
      sendReceiptToSession(sessionID, { 
        ...(walletInfo.owner ? { 
          ownerOxen: walletInfo.owner as string
        } : {
          seedPhrase: mnemonic as string 
        }),
        language,
        name,
        txHash: buyResponse.result.tx_hash
      })
    }
    setTimeout(() => walletCli.kill('SIGINT'), 1000 * 30)
  } catch(e) {
    console.error(`==[ ${name} ]==: Error while running oxen-wallet:`, e.message)
    await purchases.run('UPDATE invoices SET status = "errored" WHERE uuid = ?', invoiceUUID)  
    await sendNotificationToAdmin(`⚠️ PURCHASE FAILED (${e.message}): ${name} (${sessionID}) invId: ${invoiceUUID}`)
    return
  }

  await purchases.run('UPDATE invoices SET status = "success" WHERE uuid = ?', invoiceUUID)
}

const parseJSONResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Failed to parse JSON response: ${text}`)
  }
}