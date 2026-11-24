import { createConfig, fallback, http } from 'wagmi'
import { bsc } from 'wagmi/chains'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'
import type { CreateConnectorFn } from 'wagmi'

const wcProjectId = import.meta.env.VITE_WC_PROJECT_ID

const connectors: CreateConnectorFn[] = [injected({ shimDisconnect: true })]
if (wcProjectId) {
  connectors.push(
    walletConnect({
      projectId: wcProjectId,
      showQrModal: true,
      metadata: {
        name: 'Levium',
        description: 'AI with a receipt — verifiable AI on BNB Chain',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://levium.ai',
        icons: [typeof window !== 'undefined' ? `${window.location.origin}/favicon.svg` : ''],
      },
    }),
  )
}
connectors.push(coinbaseWallet({ appName: 'Levium' }))

export const config = createConfig({
  chains: [bsc],
  multiInjectedProviderDiscovery: true,
  connectors,
  transports: {
    [bsc.id]: fallback([http('https://bsc-dataseed.binance.org'), http('https://bsc-rpc.publicnode.com'), http('https://bsc-dataseed1.defibit.io')]),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
