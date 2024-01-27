import fs from 'fs/promises'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

const __dirname = dirname(fileURLToPath(import.meta.url)) + '/'

async function openConfig() {
  const configPath = __dirname + '../db/config.json'
  try {
    await fs.access(configPath)
  } catch {
    const newConfig = { currentBlock: 0 }
    await fs.writeFile(configPath, JSON.stringify(newConfig))
    return newConfig
  }
  return JSON.parse(await fs.readFile(configPath, 'utf-8')) as { currentBlock: number }
}

const config = await openConfig()

type BlockHeader = {
  hash: string
  num_txes: number
  height: number
}

type OnsExtra = {
  ons: {
    name_hash: string
    owner?: string
    type: string
    update?: true
    buy?: true
    value: string
    payment_id: string
  }
  payment_id: string
  pubkey: string
}

async function sync() {
  const blocks = await fetch('http://public-eu.optf.ngo:22023/json_rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: '0', method: 'get_block_count', params: {} })
  })
    .then(req => req.json()) as { result: { count: number } }
  const latestBlock = blocks.result.count
  const currentBlock = config.currentBlock
  if(currentBlock !== latestBlock) {
    console.log(`Syncing from block ${currentBlock} to ${latestBlock}`)

    const totalNumber = latestBlock - currentBlock
    const batchSize = 2500
    const blocks: BlockHeader[] = []
    for (let i = 1; i <= totalNumber; i += batchSize) {
      const blocksChunk = await fetch('http://public-eu.optf.ngo:22023/json_rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jsonrpc: '2.0', 
          id: '0', 
          method: 'get_block_headers_range', 
          params: {
            start_height: currentBlock + i,
            end_height: Math.min(currentBlock + i + batchSize - 1, latestBlock)
          }
        })
      })
        .then(req => req.json()) as { result: { headers: BlockHeader[] } }
      blocks.push(
        ...blocksChunk.result.headers
          .filter(block => block.num_txes > 0)
      )
    }
    console.log(`Found ${blocks.length} blocks with transactions`)

    const transactions: string[] = []
    for(const block of blocks) {
      const blockInfo = await fetch('http://public-eu.optf.ngo:22023/json_rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: '0',
          method: 'get_block',
          params: {
            height: block.height
          }
        })
      })
        .then(req => req.json()) as { result: { tx_hashes: string[] } }
      transactions.push(...blockInfo.result.tx_hashes)
    }
    console.log(`Found ${transactions.length} transactions`)

    const transactionsInfo = await fetch('http://public-eu.optf.ngo:22023/get_transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txs_hashes: transactions,
        tx_extra: true
      })
    })
      .then(req => req.json()) as { txs: { extra: object }[] }
    
    const onsRelatedTransactions = transactionsInfo.txs
      .filter(tx => 'extra' in tx)
      .map(tx => tx.extra as OnsExtra)
    
    await appendOnsRecords(onsRelatedTransactions)
  }
}

async function appendOnsRecords(onsRecord: OnsExtra[]) {
  console.log('Appending', onsRecord.length, 'ONS records')

}