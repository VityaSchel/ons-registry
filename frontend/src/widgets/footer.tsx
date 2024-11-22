import { CopyButton } from '@/entities/copy-button'
import { useTranslation } from 'next-i18next'
import Link from 'next/link'
import TeleramLogo from '@/assets/telegram.svg'

const linkClasses = 'hover:text-indigo-600 transition-colors duration-200 font-semibold w-fit text-base 900:text-lg'

export function Footer() {
  const { t } = useTranslation('footer')

  return (
    <footer className='bg-indigo-950 bg-opacity-30 px-4 md:px-10 py-12 flex justify-center relative overflow-clip'>
      <div className='flex flex-col sm:flex-row flex-wrap gap-12 smwht:gap-6 900:gap-12 w-[1200px] max-w-full'>
        <div className='flex flex-col gap-4 max-w-full'>
          <h2 className='smwht:h-16 lg:h-auto text-2xl 900:text-3xl font-bold'>{t('donate')}</h2>
          <CopyButton
            content={'L6j1Kam6QQfKetnvxwyAbe2eUPFuL1bZuYeDWepm7G7cM8cGh3EZBgncrpkMFN5sRKP2pWGLdxpbLf5DRYSnhBY2PypkhLC'}
            className='w-full md:w-full text-left'
          >
            OXEN:
            <span className='font-mono ml-2 hidden md:block'>L6j1Kam6QQ…BY2PypkhLC</span>
            <span className='font-mono ml-2 md:hidden'>L6j1Kam6QQfKetnvxwyAbe2eUPFuL1bZuYeDWepm7G7cM8cGh3EZBgncrpkMFN5sRKP2pWGLdxpbLf5DRYSnhBY2PypkhLC</span>
          </CopyButton>
          <CopyButton
            content={'43MTCc7BsyZip4YUpRSqGahUPf8NefifvW6KXEXttTXicTbMfAehtny26HuU84pzQNQmodxzWoTaPAL5aqPjAUo4DtkvXBV'}
            className='w-full md:w-full text-left'
          >
            XMR:
            <span className='font-mono ml-2 hidden md:block'>43MTCc7Bsy…Uo4DtkvXBV</span>
            <span className='font-mono ml-2 md:hidden'>43MTCc7BsyZip4YUpRSqGahUPf8NefifvW6KXEXttTXicTbMfAehtny26HuU84pzQNQmodxzWoTaPAL5aqPjAUo4DtkvXBV</span>
          </CopyButton>
        </div>
        <div className='flex flex-col gap-5'>
          <h2 className='smwht:h-16 lg:h-auto text-2xl 900:text-3xl font-bold'>{t('links')}</h2>
          <Link href='https://sessionbots.directory/' className={linkClasses} target='_blank' rel='noreferrer'>sessionbots.directory</Link>
          <Link href='https://sogs.hloth.dev/ons-registry?public_key=8948f2d9046a40e7dbc0a4fd7c29d8a4fe97df1fa69e64f0ab6fc317afb9c945' className={linkClasses + ' hover:text-indigo-600 transition-colors duration-200 font-semibold w-fit text-base 900:text-lg flex items-center gap-2'} target='_blank' rel='noreferrer'>
            {t('session_channel')}
          </Link>
        </div>
        <div className='ml-auto flex items-end w-48 shrink-0 flex-col justify-between gap-4'>
          <Link className={linkClasses} href='https://gist.github.com/VityaSchel/72210ebeb247816d09261b5194159cc6' target='_blank' rel='nofollow noreferrer'>API Docs</Link>
          <span className='text-muted text-right'>{t('made_by')} <Link href='https://github.com/vityaschel' className='font-semibold hover:text-indigo-600 transition-colors duration-200'>{t('author')}</Link></span>
        </div>
      </div>
      <div className='pointer-events-none absolute bottom-[-65vw] bg-gradient-radial w-[120vw] h-auto aspect-square from-indigo-900 gradien via-transparent to-transparent opacity-20'></div>
    </footer>
  )
}