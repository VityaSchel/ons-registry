import { purchases } from './db.js'

export async function sendItem(invoiceUUID: string, name: string, sessionID: string) {
  await purchases.run('UPDATE invoices SET status = "processing" WHERE uuid = ?', invoiceUUID)  

  console.log(`Sending item to ${name} (${sessionID})`)
}