import { HomepageHero } from '@/widgets/homepage/hero'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { Inter } from 'next/font/google'
import Head from 'next/head'
import { useTranslation } from 'next-i18next'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export default function HomePage() {
  const { t } = useTranslation('common')
  
  return (
    <>
      <Head>
        <title>ONS Registry</title>
        <meta name="description" content={t('description')} />
        <meta name="ogp:title" content='ONS Registry' />
        <meta name="ogp:description" content={t('description')} />
        <meta name="ogp:sitename" content='ONS Registry' />
      </Head>
      <main
        className={`flex min-h-screen flex-col items-center justify-between ${inter.className} antialiased font-semibold pb-12`}
      >
        <HomepageHero />
      </main>
    </>
  )
}

export async function getStaticProps({ locale }: { locale: string }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, [
        'common',
      ])),
    },
  }
}