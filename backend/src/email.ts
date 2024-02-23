import nodemailer from 'nodemailer'
import fs from 'fs/promises'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url)) + '/'

const transporter = nodemailer.createTransport({
  host: 'localhost',
  port: 25,
  secure: false,
  auth: {
    user: 'ons',
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false
  },
})

export async function sendEmail({ from, to, subject, text }: {
  from: { email: string, name: string }
  to: { email: string }[]
  subject: string
  text: string
}) {
  const info = await transporter.sendMail({
    from: `"${from.name}" <${from.email}>`,
    to: to.map(e => e.email).join(', '),
    subject: subject,
    text: text,
    dkim: {
      domainName: 'ons.sessionbots.directory',
      keySelector: 'default',
      privateKey: await fs.readFile(__dirname + '../keys/dkim_private.pem', 'utf-8')
    }
  })

  return info
}
