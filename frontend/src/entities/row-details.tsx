import React from 'react'
import { OnsRecord } from '@/shared/model/ons-record'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/shadcn/ui/dialog'
import { Copy, CopyCheck } from 'lucide-react'
import copy from 'copy-to-clipboard'
import { useTranslation } from 'next-i18next'

export function RowDetails({ record, onClose }: {
  record: OnsRecord | false
  onClose: () => void
}) {
  const { t } = useTranslation()

  const [recordMemo, setRecordMemo] = React.useState<OnsRecord>({
    transactionId: '',
    updatedAtBlock: 0,
    expiresAtBlock: 0,
    action: null,
    sessionIdEncrypted: '',
    owner: '',
    backupOwner: '',
    sessionId: null,
    nameHash: '',
    name: null,
  })

  React.useEffect(() => {
    if (record !== false)
      setRecordMemo(record)
  }, [record])

  return (
    <Dialog open={record !== false} onOpenChange={visible => !visible && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{recordMemo.name ?? <span className='text-muted'>{t('details.hashed_name')}</span>}</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          <table className='border-spacing-y-3 border-separate [&>tbody>tr>td]:border-t [&>tbody>tr>td]:pt-3 [&>tbody>tr>td]:align-top'>
            <tbody>
              {recordMemo.nameHash && (
                <tr>
                  <td className='pr-4'>{t('details.name_hash')}</td>
                  <CopiableTd>{recordMemo.nameHash}</CopiableTd>
                </tr>
              )}
              {recordMemo.sessionIdEncrypted && (
                <tr>
                  <td className='pr-4'>{t('details.encrypted_value')}</td>
                  <CopiableTd>{recordMemo.sessionIdEncrypted}</CopiableTd>
                </tr>
              )}
              <tr>
                <td className='pr-4'>{t('details.transaction_id')}</td>
                <CopiableTd>{recordMemo.transactionId}</CopiableTd>
              </tr>
              <tr>
                <td className='pr-4'>{t('details.backup_owner')}</td>
                {recordMemo.backupOwner
                  ? <CopiableTd>{recordMemo.backupOwner}</CopiableTd>
                  : <td><span className='text-muted'>{t('details.empty')}</span></td>
                }
              </tr>
              <tr>
                <td className='pr-4'>{t('details.update_block_height')}</td>
                <CopiableTd>{recordMemo.updatedAtBlock}</CopiableTd>
              </tr>
              <tr>
                <td className='pr-4'>{t('details.expiration_block_height')}</td>
                {recordMemo.expiresAtBlock ?
                  <CopiableTd>{recordMemo.expiresAtBlock}</CopiableTd>
                  : <td><span className='text-muted'>{t('details.empty')}</span></td>
                }
              </tr>
            </tbody>
          </table>
        </DialogDescription>
      </DialogContent>
    </Dialog>
  )
}

function CopiableTd({ children }: { children: string | number }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    copy(children.toString())
    setCopied(true)
  }

  return (
    <td>
      <button className='[overflow-wrap:anywhere] text-left' onPointerDown={handleCopy} onPointerOut={() => setCopied(false)}>
        {children}
        {copied
          ? <CopyCheck size={12} className='inline-block ml-2 align-center' />
          : <Copy size={12} className='inline-block ml-2 align-center' />
        }
      </button>
    </td>
  )
}