import { Search } from '@/features/search'
import { useTranslation } from 'next-i18next'

export function HomepageHero() {
  const { t } = useTranslation('common')
  
  return (
    <div className='mt-24 lg:mt-[30vh] flex flex-col gap-5 max-w-full items-center px-4 md:px-10'>
      <div className='top-0 absolute w-screen h-[1400px] overflow-hidden pointer-events-none'>
        <div className='pointer-events-none absolute top-[-500px] left-[-500px] bg-gradient-radial w-[1200px] h-[1200px] from-indigo-900 gradien via-transparent to-transparent opacity-20'></div>
        <div className='pointer-events-none absolute right-[-700px] top-[-200px] bg-gradient-radial w-[1200px] h-[1200px] from-indigo-900 gradien via-transparent to-transparent opacity-10'></div>
      </div>
      <div className='flex flex-col gap-8 justify-center items-center max-w-[800px] w-full'>
        <h1 className='scroll-m-20 text-6xl font-extrabold tracking-tight md:text-7xl text-left 430:text-center'>{t('title')}</h1>
        <p className='text-left font text-md md:text-lg 430:text-center'>{t('description')}</p>
      </div>
      <Search />
    </div>
  )
}