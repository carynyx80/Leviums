import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { config } from './lib/wagmi'
import { ToastProvider } from './lib/toast'
import { WalletModalProvider } from './components/Wallet'
import App from './App'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <ToastProvider>
            <WalletModalProvider>
              <App />
            </WalletModalProvider>
          </ToastProvider>
        </MotionConfig>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
