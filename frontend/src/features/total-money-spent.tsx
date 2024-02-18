import React from 'react'
import { useTranslation } from 'next-i18next'
import cx from 'classnames'
import { Tooltip } from '@/shared/ui/tooltip'
import { GoQuestion } from 'react-icons/go'

export function TotalMoneySpent({ owner }: {
  total: number
  owner: string
}) {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = React.useState(true)
  const [amount, setAmount] = React.useState<number>(0)
  const [isOffline, setIsOffline] = React.useState(false)

  React.useEffect(() => {
    if (!window.navigator.onLine) {
      setIsOffline(true)
      return
    }

    function fetchAmount(fiat: 'rub' | 'usd') {
      setLoading(true)
      const abort = new AbortController()

      const promise = new Promise<number>((resolve, reject) => {
        fetch(process.env.NEXT_PUBLIC_API_URL + '/cost?' + new URLSearchParams({
          fiat,
          owner
        }), {
          signal: abort.signal
        })
          .then(res => res.json() as Promise<{ ok: true, amount: number } | { ok: false, error: string }>)
          .then(response => {
            if (response.ok) {
              resolve(response.amount)
            }
          })
          .catch(reject)
      })

      return { abort, promise }
    }

    const fiat = i18n.language === 'ru' ? 'rub' : 'usd'

    const { abort, promise } = fetchAmount(fiat)
    promise
      .then(amount => {
        setAmount(amount)
        setLoading(false)
      })
      .catch(() => {
        setIsOffline(true)
      })

    return () => {
      abort.abort()
    }
  }, [owner, i18n.language])

  if (isOffline) {
    return (
      <span>
        {t('statistics.connect_to_estimate_money')}
      </span>
    )
  }

  return (
    <span className={cx({
      'opacity-0': loading
    })}>
      {t('statistics.this_person_money')
        .replace('{totalSum}', 
          i18n.language === 'ru'
            ? `≈${amount.toFixed(2)} RUB`
            : `≈${amount.toFixed(2)} USD`
        )
      }
      <span className='ml-2 align-middle'>
        <Tooltip content={
          <span className='text-center block w-96 max-w-[90vw] whitespace-pre-wrap text-white'>
            {t('statistics.this_person_money_explanation')}
          </span>
        }>
          <GoQuestion />
        </Tooltip>
      </span>
    </span>
  )
}