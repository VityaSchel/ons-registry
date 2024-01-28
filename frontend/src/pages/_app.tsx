import '@/shared/styles/tailwind.css'
import '@/shared/styles/globals.scss'
import { appWithTranslation } from 'next-i18next'
import type { AppProps } from 'next/app'
import { ThemeProvider } from '@/app/theme-provider'
import { Toaster } from 'sonner'

function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <Toaster richColors />
      <Component {...pageProps} />
    </ThemeProvider>
  )
}


export default appWithTranslation(App)