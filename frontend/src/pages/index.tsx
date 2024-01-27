import { HomepageHero } from '@/widgets/homepage/hero'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin', 'cyrillic'] })

export default function HomePage() {
  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-between ${inter.className} antialiased font-semibold`}
    >
      <HomepageHero />
    </main>
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