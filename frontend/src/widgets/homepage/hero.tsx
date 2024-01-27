import { Search } from '@/features/search'
import { useTranslation } from 'next-i18next'

export function HomepageHero() {
  const { t } = useTranslation('common')
  
  return (
    <div className='mt-[15vh] flex flex-col gap-8 justify-center items-center max-w-[800px] w-full'>
      <h1 className='scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-7xl'>{t('title')}</h1>
      <p className='text-center font text-lg'>{t('description')}</p>
      <Search />
      <div className='pointer-events-none absolute top-[-500px] left-[-500px] bg-gradient-radial w-[1200px] h-[1200px] from-indigo-900 gradien via-transparent to-transparent opacity-20'></div>
      <div className='pointer-events-none absolute right-[-700px] top-[-200px] bg-gradient-radial w-[1200px] h-[1200px] from-indigo-900 gradien via-transparent to-transparent opacity-10'></div>
    </div>
  )
}