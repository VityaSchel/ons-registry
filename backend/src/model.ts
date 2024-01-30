import sqlite3 from 'sqlite3'
import { Database } from 'sqlite'

export type BlockHeader = {
  hash: string
  num_txes: number
  height: number
}

export type OnsExtra = {
  ons: {
    name_hash: string
    owner?: string
    blocks?: true
    backup_owner?: string
    type: 'session' | 'lokinet' | 'wallet'
    update?: true
    buy?: true
    renew?: true
    value: string
  }
  payment_id?: string
  pubkey?: string
}

export type OnsRecord = {
  name_hash: string
  owner?: string
  backup_owner?: string
  type: 'session' | 'lokinet' | 'wallet'
  value: string
  transaction_id: string
  updated_at_block: number
  expires_at_block?: number
  action?: 'update' | 'buy' | 'renew'
  payment_id?: string
}

export type Db = Database<sqlite3.Database, sqlite3.Statement>