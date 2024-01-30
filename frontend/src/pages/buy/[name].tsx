import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import Head from 'next/head'
import { useTranslation } from 'next-i18next'
import { BuyForm } from '@/widgets/buy/buy-form'

export default function BuyNamePage() {
  const { t } = useTranslation('buy')
  
  return (
    <>
      <Head>
        <title>{t('title')}</title>
        <meta name="description" content={t('description')} />
        <meta name="ogp:title" content={t('title')} />
        <meta name="ogp:description" content={t('description')} />
        <meta name="ogp:sitename" content='ONS Registry' />
      </Head>
      <main
        className='flex min-h-screen flex-col items-center justify-between antialiased font-semibold pb-24'
      >
        <BuyForm />
      </main>
    </>
  )
}

export async function getServerSideProps({ locale }: { locale: string }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, [
        'buy', 'footer'
      ])),
    },
  }
}