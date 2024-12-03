import React from 'react'
import '@/shared/styles/tailwind.css'
import '@/shared/styles/globals.scss'
import { appWithTranslation } from 'next-i18next'
import type { AppProps } from 'next/app'
import { ThemeProvider } from '@/app/theme-provider'
import { Toaster } from 'sonner'
import { Footer } from '@/widgets/footer'
import { Provider as StoreProvider } from 'react-redux'
import { store } from '@/shared/store'

import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
})

function App({ Component, pageProps }: AppProps) {
  return (
    <StoreProvider store={store}>
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
        <MigrationAlert />
        <Footer />
      </ThemeProvider>
    </StoreProvider>
  )
}

function MigrationAlert() {
  const [isMounted, setIsMounted] = React.useState(false)
  const [isOldUrl, setIsOldUrl] = React.useState(false)
  const [closed, setClosed] = React.useState(false)

  React.useEffect(() => {
    if(typeof window !== 'undefined') {
      setIsMounted(true)
      setIsOldUrl(window.location.hostname === 'ons.sessionbots.directory')
    }
  }, [])

  return isMounted && isOldUrl && !closed && (
    <div className='fixed top-0 left-0 z-[9999] bg-black/50 flex items-center justify-center w-full h-full'>
      <div className='bg-white p-4 rounded-sm text-black flex flex-col text-center items-center justify-center gap-2'>
        <h1 className='font-medium text-lg'>We&apos;re migrating</h1>
        <p>ons.sessionbots.directory is now <a href='https://ons.session.community' className='underline font-medium'>ons.session.community</a></p>
        <button onClick={() => setClosed(true)} className='px-2 py-1 bg-indigo-600 text-white rounded-lg shadow-sm'>Close</button>
      </div>
    </div>
  )
}

export default appWithTranslation(App)