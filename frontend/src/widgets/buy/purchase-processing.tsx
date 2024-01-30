import React from 'react'
import { useTranslation } from 'next-i18next'
import { useRouter } from 'next/router'
import { PulseLoader } from 'react-spinners'
import { GetServerSidePropsContext, GetServerSidePropsResult } from 'next'
import * as Yup from 'yup'

export function PurchaseProcessing() {
  const { t } = useTranslation('buy')
  const { invoice } = useRouter().query
  const [status, setStatus] = React.useState<'created' | 'processing' | 'canceled' | 'success' | 'errored'>('created')

  React.useEffect(() => {
    if (status === 'processing' || status === 'created') {
      checkStatus()
      
      const interval = setInterval(() => {
        checkStatus()
      }, 3000)
      
      return () => {
        clearInterval(interval)
      }
    }
  }, [invoice, status])

  const checkStatus = () => {
    fetch(process.env.NEXT_PUBLIC_API_URL + '/purchase/status?' + new URLSearchParams({
      invoice: Array.isArray(invoice) ? invoice[0] : invoice as string
    }))
      .then<{ ok: true, status: typeof status } | { ok: false, error: string }>(res => res.json())
      .then(response => {
        if (response.ok) {
          setStatus(response.status)
        } else {
          if (response.error === 'NOT_FOUND') {
            setStatus('canceled')
          } else {
            console.error(response.error)
          }
        }
      })
  }

  return (
    <div className='mt-12 lg:mt-[25vh] flex flex-col gap-5 max-w-full items-center px-4 md:px-10'>
      <div className='top-0 absolute w-screen h-[200vh] max-h-screen overflow-hidden pointer-events-none'>
        <div className='pointer-events-none absolute top-[-500px] left-[-500px] bg-gradient-radial w-[1200px] h-[1200px] from-indigo-900 gradien via-transparent to-transparent opacity-20'></div>
        <div className='pointer-events-none absolute right-[-700px] top-[-200px] bg-gradient-radial w-[1200px] h-[1200px] from-indigo-900 gradien via-transparent to-transparent opacity-10'></div>
      </div>
      <div className='flex gap-8 flex-col justify-between max-w-full w-[1200px]'>
        <h1 className='scroll-m-20 text-3xl font-extrabold tracking-tight md:text-5xl text-left'>
          {t(`statuses.${status}.title`)}
        </h1>
        <p className='text-left font text-base md:text-md max-w-full w-[600px]'>
          {t(`statuses.${status}.description`)}
        </p>
        {(status === 'processing' || status === 'created') && <PulseLoader color='rgb(18, 199, 186)' />}
      </div>
    </div>
  )
}

export async function getServerSideProps(context: GetServerSidePropsContext): Promise<GetServerSidePropsResult<Record<string, never>>> {
  if(!await Yup.string().uuid().isValid(context.query.invoice)) {
    return {
      notFound: true
    }
  } else {
    return {
      props: {}
    }
  }
}