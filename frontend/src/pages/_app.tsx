import '@/shared/styles/tailwind.css'
import '@/shared/styles/globals.scss'
import { appWithTranslation } from 'next-i18next'
import type { AppProps } from 'next/app'
import { ThemeProvider } from '@/app/theme-provider'
import { Toaster } from 'sonner'
import { Footer } from '@/widgets/footer'

import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
})

function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      // enableSystem
      disableTransitionOnChange
    >
      <Toaster richColors />
      <style jsx global>{`
        :root {
          --font-sans: ${inter.style.fontFamily};
        }
      `}</style>
      <Component {...pageProps} />
      <Footer />
    </ThemeProvider>
  )
}


export default appWithTranslation(App)