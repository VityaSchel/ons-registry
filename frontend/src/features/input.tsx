import React from 'react'
import cx from 'classnames'
import { useTranslation } from 'next-i18next'
import { LuKeySquare } from 'react-icons/lu'
import OxenLogoFull from '@/assets/oxen-logo-full.svg'
import { Open_Sans } from 'next/font/google'

const openSans = Open_Sans({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
})

export function Input({ mode, placeholder, onChange, maxLength }: {
  mode: 'by_author' | 'names'
  placeholder: string
  onChange: (value: string) => void
  maxLength: number
}) {
  const { t } = useTranslation('common')
  const [value, setValue] = React.useState('')
  const [isEasterEggVisible, setIsEasterEggVisible] = React.useState(false)

  const isValidONSName = React.useMemo(() => {
    return new RegExp('^\\w([\\w-]*[\\w])?$', 'g')
      .test(value)
  }, [value])

  const isValidOwner = React.useMemo(() => {
    return new RegExp('^[0-9a-fA-F]+$', 'g')
      .test(value)
  }, [value])

  const isValidQuery = isValidONSName || isValidOwner

  React.useEffect(() => {
    onChange(value)
  }, [value])

  const easterEggAvailable = mode === 'names' && ['devio', 'vitya-devio', 'devio-vitya', 'vitya+devio', 'devio+vitya', 'vitya.plus.devio.love', 'vitya+dima', 'dima+vitya'].includes(value)

  return (
    <>
      <span className='absolute left-4 top-2 430:left-8 430:top-6 transition-opacity duration-150 pointer-events-none text-ellipsis overflow-hidden max-w-full line-clamp-1 break-all font-open-sans z-[3]' style={{
        width: 'calc(100% - 4rem)',
        opacity: mode === 'by_author' ? 1 : 0,
        color: value.length === 0 
          ? '#aaaaaa' 
          : value.length === 160
            ? '#2563eb'
            : '#5cc4ba'
      }}>
        {value.length === 0 ? (
          <span>{t('search.search_by_owner_type')}</span>
        ) : value.length === 160 ? (
          <span className='flex items-center'>
            <LuKeySquare color='#2563eb' className='mr-2' />
            ED25519 keypair
          </span>
        ) : (
          <span className='flex items-center'>
            <span className='block w-fit h-5 bg-[#5cc4ba] p-1 rounded-sm mr-2'>
              <OxenLogoFull className='h-full' />
            </span>
            Wallet
          </span>
        )}
      </span>
      <span className={cx(`absolute mt-0.5 ml-0.5 left-4 top-3 430:left-8 430:top-6 text-2xl 430:text-4xl ${openSans.className} overflow-hidden max-w-full break-all text-clip h-10 transition-opacity z-[3]`, {
        'opacity-0 pointer-events-none': !easterEggAvailable
      })}><span className='pointer-events-none opacity-0'>{value}</span> <button onClick={() => setIsEasterEggVisible(true)} tabIndex={easterEggAvailable ? 0 : -1}>❤️</button></span>
      <input
        type="text"
        className={cx(`py-3 px-4 430:py-6 430:px-8 text-2xl 430:text-4xl rounded-lg shadow-lg dark:shadow-slate-950/15 outline-none bg-neutral-800 placeholder:text-neutral-600 max-w-full w-[800px] border-2 border-transparent transition-all duration-75 h-16 430:h-[92px] ${openSans.className} z-[1]`, {
          '!border-red-500': value && !isValidQuery,
          'text-sm 430:text-sm pt-6 430:pt-6 pb-0 430:pb-0': mode === 'by_author'
        })}
        placeholder={placeholder}
        value={value}
        onChange={e => setValue(e.target.value.replaceAll(' ', ''))}
        maxLength={maxLength}
      />
      {isEasterEggVisible && <video className='w-[800px] max-w-full' src='/devio.mp4' autoPlay onEnded={() => setIsEasterEggVisible(false)} />}
    </>
  )
}