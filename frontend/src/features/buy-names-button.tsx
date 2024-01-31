import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'next-i18next'
import { ArrowRight } from 'lucide-react'

export function BuyNamesButton({ loading, state, name }: {
  loading: boolean
  state: 'default' | 'free' | 'taken'
  name: string
}) {
  const [buttonState, setButtonState] = React.useState<typeof state>('default')
  const { t } = useTranslation('common')

  React.useEffect(() => {
    if(!loading) setButtonState(state)
  }, [loading, state])

  return (
    <Link href={name ? `/buy?name=${name}` : '/buy'} className='w-full h-8 bg-neutral-900 flex items-center -mt-4 px-3 pb-2 pt-4 rounded-b-lg text-xs hover:!text-[var(--hover-color)] transition-colors' style={{
      // lighter than hover
      color: buttonState === 'default'
        ? 'hsl(174, 47%, 60%)'
        : buttonState === 'free'
          ? '#2563eb'
          : 'hsl(32, 82%, 56%)',
      '--hover-color': buttonState === 'default'
        ? 'hsl(174, 47%, 40%)'
        : buttonState === 'free'
          ? '#1e4ecb'
          : 'hsl(32, 82%, 40%)',
    }}>
      {buttonState === 'default'
        ? t('buy_button.default')
        : buttonState === 'free'
          ? t('buy_button.free')
          : t('buy_button.taken')
      }
      <ArrowRight className='ml-1' size={12} />
    </Link>
  )
}