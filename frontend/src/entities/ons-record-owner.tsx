import copy from 'copy-to-clipboard'
import { LuKeySquare } from 'react-icons/lu'
import OxenLogo from '@/assets/oxen-logo.svg'
import { toast } from 'sonner'
import { Tooltip } from '@/shared/ui/tooltip'
import { useTranslation } from 'next-i18next'

export function OnsRecordOwner({ owner, ownerDisplay }: {
  owner: { keypair: string, oxen: string }
  ownerDisplay: 'keypair' | 'oxen'
}) {
  const { t } = useTranslation('common')

  const handleCopy = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    copy(owner[ownerDisplay])
    toast.success(t('ons_record.owner.copied'))
  }

  return (
    <div className='flex gap-2 items-center'>
      <Tooltip delayDuration={300} content={
        <p className='max-w-80 text-white'>
          {ownerDisplay === 'oxen' ? t('ons_record.owner.owner_type_wallet') : t('ons_record.owner.owner_type_keypair')}
        </p>
      }>
        {(props) => (
          <button className='w-4 shrink-0' onClick={e => e.stopPropagation()} {...props}>
            {ownerDisplay === 'keypair' ? (
              <LuKeySquare color='#2563eb' />
            ) : (
              <OxenLogo />
            )}
          </button>
        )}
      </Tooltip>
      <Tooltip delayDuration={200} content={
        <p className='max-w-80 text-white'>
          {t('copy')}
        </p>
      }>
        {(props) => (
          <button className='text-ellipsis overflow-hidden max-w-full block' onClick={handleCopy} {...props}>
            {owner[ownerDisplay]}
          </button>
        )}
      </Tooltip>
    </div>
  )
}