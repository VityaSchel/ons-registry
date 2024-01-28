import { CopyButton } from '@/entities/copy-button'
import { useTranslation } from 'next-i18next'
import Link from 'next/link'

export function Footer() {
  const { t } = useTranslation('common')

  return (
    <footer className='bg-indigo-950 bg-opacity-30 p-12 flex gap-12'>
      <div className='flex flex-col gap-4'>
        <h2 className='text-3xl font-bold'>{t('footer.donate')}</h2>
        <CopyButton
          content={'L6j1Kam6QQfKetnvxwyAbe2eUPFuL1bZuYeDWepm7G7cM8cGh3EZBgncrpkMFN5sRKP2pWGLdxpbLf5DRYSnhBY2PypkhLC'}
          className='md:w-auto w-full'
        >
          OXEN:
          <span className='font-mono ml-2'>
            L6j1Kam6QQ…BY2PypkhLC
          </span>
        </CopyButton>
        <CopyButton
          content={'43MTCc7BsyZip4YUpRSqGahUPf8NefifvW6KXEXttTXicTbMfAehtny26HuU84pzQNQmodxzWoTaPAL5aqPjAUo4DtkvXBV'}
          className='md:w-auto w-full'
        >
          XMR:
          <span className='font-mono ml-2'>
            43MTCc7Bsy…Uo4DtkvXBV
          </span>
        </CopyButton>
      </div>
      <div className='flex flex-col gap-4'>
        <h2 className='text-3xl font-bold'>{t('footer.links')}</h2>
        <Link href='https://sessionbots.directory/' className='hover:text-indigo-600 transition-colors duration-200 font-semibold w-fit'>sessionbots.directory</Link>
      </div>
      <div className='ml-auto flex items-end text-muted w-48 text-right'>
        <span>{t('footer.made_by')} <Link href='https://github.com/vityaschel' className='font-semibold hover:text-indigo-600 transition-colors duration-200'>{t('footer.author')}</Link></span>
      </div>
    </footer>
  )
}