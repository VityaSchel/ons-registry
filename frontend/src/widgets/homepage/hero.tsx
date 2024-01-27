import { Search } from '@/features/search'
import { useTranslation } from 'next-i18next'

export function HomepageHero() {
  const { t } = useTranslation('common')
  
  return (
    <div className='mt-4 flex flex-col gap-8 justify-center items-center max-w-[800px] w-full'>
      <h1 className='scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-7xl'>{t('title')}</h1>
      <p className='text-center font text-lg'>{t('description')}</p>
      <Search />
    </div>
  )
}