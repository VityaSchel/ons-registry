import { purchases } from './db.js'
import { spawn } from 'child_process'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { glob } from 'glob'
import fs from 'fs/promises'
import _ from 'lodash'
import tcpPortUsed from 'tcp-port-used'
import { MailtrapClient } from 'mailtrap'

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

export async function sendItem(invoiceUUID: string, name: string, sessionID: string, language: 'ru' | 'en', email?: string) {
  await purchases.run('UPDATE invoices SET status = "processing" WHERE uuid = ?', invoiceUUID)  

  const walletDir = __dirname + '../.oxen/'
  const wallets = await glob(walletDir + 'wallet-*')
  
  if (wallets.length === 0) {
    console.log(`==[ ${name} ]==: No oxen wallets available`)
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
    console.log(`==[ ${name} ]==: No available ports`)
    await purchases.run('UPDATE invoices SET status = "errored" WHERE uuid = ?', invoiceUUID)  
    await sendNotificationToAdmin(`⚠️ PURCHASE FAILED: NO AVAILABLE PORTS ⚠️ ${name} (${sessionID}) invId: ${invoiceUUID}`)
    return
  }

  console.log(`Sending item to ${name} (${sessionID})`)
  console.log(`==[ ${name} ]==: Spawning oxen wallet`, wallet, 'on port', walletPort)
  
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

    const mnemonicRequest = await fetch(`http://127.0.0.1:${walletPort}/json_rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
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
    const mnemonicResponse = await mnemonicRequest.json() as { result: { key: string } }
    const mnemonic = mnemonicResponse.result.key
    if(!mnemonic) {
      throw new Error('No mnemonic in response')
    }

    const buyRequest = await fetch(`http://127.0.0.1:${walletPort}/json_rpc`, {
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
    const buyResponse = await buyRequest.json() as { error: { code: number, message: string } } | { result: object }
    if ('error' in buyResponse) {
      console.error(`==[ ${name} ]==: Error while buying item:`, buyResponse.error.message)
      await purchases.run('UPDATE invoices SET status = "errored" WHERE uuid = ?', invoiceUUID)
      await sendNotificationToAdmin(`⚠️ PURCHASE FAILED (${buyResponse.error.message}): ${name} (${sessionID}) invId: ${invoiceUUID}`)  
      return
    } else {
      console.log(`==[ ${name} ]==: Successfully bought mapping:`, buyResponse.result)
      await purchases.run('UPDATE invoices SET status = "success" WHERE uuid = ?', invoiceUUID)
      if (email) {
        sendEmailWithSeedPhrase(email, mnemonic, language)
      } else {
        console.log(`==[ ${name} ]==: User did not specify email, so keeping seed phrase safe`)
      }
    }
  } catch(e) {
    console.error(`==[ ${name} ]==: Error while running oxen-wallet:`)
    await purchases.run('UPDATE invoices SET status = "errored" WHERE uuid = ?', invoiceUUID)  
    await sendNotificationToAdmin(`⚠️ PURCHASE FAILED (${e.message}): ${name} (${sessionID}) invId: ${invoiceUUID}`)
    return
  }

  await purchases.run('UPDATE invoices SET status = "success" WHERE uuid = ?', invoiceUUID)
  await purchases.run('UPDATE invoices SET status = "error" WHERE uuid = ?', invoiceUUID)
}


const TOKEN = process.env.MAILTRAP_API_KEY
if(!TOKEN) throw new Error('MAILTRAP_API_KEY not set')
const ENDPOINT = 'https://send.api.mailtrap.io/'
const client = new MailtrapClient({ endpoint: ENDPOINT, token: TOKEN })

function sendEmailWithSeedPhrase(email: string, seedPhrase: string, language: 'ru' | 'en') {
  const sender = {
    email: 'mailtrap@ons.sessionbots.directory',
    name: 'ONS Registry',
  }

  if(language === 'ru') {
    client.send({
      from: sender,
      to: [{ email }],
      subject: 'Спасибо за покупку ONS имени в Session',
      text: 'Поздравляем с покупкой имени! Ваше имя уже активно и вас уже можно найти по нему в Session (если вы еще не можете перейти по нему, подождите до 10 минут для регистрации в блокчейне). Если вы захотите управлять своим именем (например, привязать это имя к другому SessionID), вам потребуется установить официальное приложение OXEN Wallet и ввести туда эту фразу: ' + seedPhrase + '. НИКОМУ НЕ ПОКАЗЫВАЙТЕ ЭТУ ФРАЗУ — она дает доступ к купленному вами имени в блокечейне. Пожалуйста, имейте в виду, что мы никак не связаны с OXEN, Session и не можем управлять блокчейном, а также помочь с вопросами, связанными с этим. Наш сайт не поддерживает управление вашим именем после покупки.\n\nСпасибо за покупку и ждем вас снова!',
      category: 'Purchase completed',
    })
  } else {
    client.send({
      from: sender,
      to: [{ email }],
      subject: 'Thank you for purchasing ONS name in Session',
      text: 'Congratulations on your purchase! Your name is already active and you can already be found by it in Session (if you still cannot go to it, wait up to 10 minutes for registration in the blockchain). If you want to manage your name (for example, bind this name to another SessionID), you will need to install the official OXEN Wallet app and enter this phrase there: ' + seedPhrase + '. DO NOT SHOW THIS PHRASE TO ANYONE - it gives access to the name you bought in the blockchain. Please note that we are not affiliated with OXEN, Session and cannot control the blockchain, as well as help with issues related to this. Our site does not support managing your name after purchase.\n\nThank you for your purchase!',
      category: 'Purchase completed',
    })
  }
}