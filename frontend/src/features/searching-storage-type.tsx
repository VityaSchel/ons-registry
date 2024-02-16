import { useAppSelector } from '@/shared/store/hooks'
import { selectSearchStorageState } from '@/shared/store/slices/search-storage'
import { Tooltip } from '@/shared/ui/tooltip'
import { useTranslation } from 'next-i18next'
import { GoQuestion } from 'react-icons/go'
import { formatRelative } from 'date-fns'
import * as Locales from 'date-fns/locale'

export function SearchingStorageType() {
  const { searchStorageType, searchStorageLastUpdate } = useAppSelector(selectSearchStorageState)
  const { t, i18n } = useTranslation('common')

  return (
    <div className='flex justify-end h-6'>
      {searchStorageType !== 'initializing' && (
        <span className='font-medium text-neutral-600 flex gap-1.5 items-center text-sm'>
          {searchStorageType === 'local' ? t('searching_storage.type.local') : t('searching_storage.type.remote')}
          <Tooltip content={
            <span className='text-center block max-w-xl whitespace-pre-wrap text-white'>
              {searchStorageType === 'local' 
                ? t('searching_storage.hints.local')
                  .replace('{lastUpdate}', 
                    formatRelative(searchStorageLastUpdate as Date, new Date(), { 
                      ...(i18n.language === 'ru' && { locale: Locales.ru })
                    }))
                : t('searching_storage.hints.remotely')}
            </span>
          }>
            <GoQuestion />
          </Tooltip>
        </span>
      )}
    </div>
  )
}