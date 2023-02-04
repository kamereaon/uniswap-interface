import '@reach/dialog/styles.css'
import 'inter-ui'
import 'polyfills'
import 'components/analytics'

import { ApolloProvider } from '@apollo/client'
import * as Sentry from '@sentry/react'
import { ProviderConnectInfo, RequestArguments } from '@web3-react/types'
import { FeatureFlagsProvider } from 'featureFlags'
import { apolloClient } from 'graphql/data/apollo'
import { BlockNumberProvider } from 'lib/hooks/useBlockNumber'
import { MulticallUpdater } from 'lib/state/multicall'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from 'react-query'
import { Provider } from 'react-redux'
import { HashRouter } from 'react-router-dom'
import { isSentryEnabled } from 'utils/env'

import Web3Provider from './components/Web3Provider'
import { LanguageProvider } from './i18n'
import App from './pages/App'
import * as serviceWorkerRegistration from './serviceWorkerRegistration'
import store from './state'
import ApplicationUpdater from './state/application/updater'
import ListsUpdater from './state/lists/updater'
import LogsUpdater from './state/logs/updater'
import TransactionUpdater from './state/transactions/updater'
import UserUpdater from './state/user/updater'
import ThemeProvider, { ThemedGlobalStyle } from './theme'
import RadialGradientByChainUpdater from './theme/components/RadialGradientByChainUpdater'

if (window.ethereum) {
  window.ethereum.autoRefreshOnNetworkChange = false
  // cast and set window.ethereum to our wrapper
  window.ethereum = wrapWithSandigo(window.ethereum) as any
}

if (isSentryEnabled()) {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    release: process.env.REACT_APP_GIT_COMMIT_HASH,
  })
}

function Updaters() {
  return (
    <>
      <RadialGradientByChainUpdater />
      <ListsUpdater />
      <UserUpdater />
      <ApplicationUpdater />
      <TransactionUpdater />
      <MulticallUpdater />
      <LogsUpdater />
    </>
  )
}

const queryClient = new QueryClient()

const container = document.getElementById('root') as HTMLElement

createRoot(container).render(
  <StrictMode>
    <Provider store={store}>
      <FeatureFlagsProvider>
        <QueryClientProvider client={queryClient}>
          <HashRouter>
            <LanguageProvider>
              <Web3Provider>
                <ApolloProvider client={apolloClient}>
                  <BlockNumberProvider>
                    <Updaters />
                    <ThemeProvider>
                      <ThemedGlobalStyle />
                      <App />
                    </ThemeProvider>
                  </BlockNumberProvider>
                </ApolloProvider>
              </Web3Provider>
            </LanguageProvider>
          </HashRouter>
        </QueryClientProvider>
      </FeatureFlagsProvider>
    </Provider>
  </StrictMode>
)

if (process.env.REACT_APP_SERVICE_WORKER !== 'false') {
  serviceWorkerRegistration.register()
}

function wrapWithSandigo(ethereum: any) {
  // https://eips.ethereum.org/EIPS/eip-1193
  console.log('sandigo first thing first', ethereum)
  // We want to create a wrapper object to ethereum which calls the original functions but add logs, just like aspect oriented programming
  const ethereumWrapper = {
    request: async (request: RequestArguments) => {
      console.trace('sandigo request', request)
      const newRequest = changeRequest(request)
      const response = await ethereum?.request(newRequest)
      console.trace('sandigo response', request, response)
      return changeResponse(request, response)
    },
    on: (eventName: string, listener: (args: any) => void) => {
      console.trace('sandigo on', eventName, listener)
      return ethereum?.on(eventName, createListener(eventName, listener))
    },
  }
  return ethereumWrapper
}

function changeRequest(originalRequest: RequestArguments): RequestArguments {
  if (originalRequest.method === 'eth_signTypedData' || originalRequest.method === 'eth_signTypedData_v4') {
    // string to json to params[1]
    const params = originalRequest.params as unknown[]
    const jsonData = JSON.parse(params[1] as string)
    jsonData.domain.chainId = 5401
    // change
    const newRequest = {
      method: originalRequest.method,
      params: [params[0], JSON.stringify(jsonData)],
    } as RequestArguments
    console.log('sandigo changed request for', newRequest)
    return newRequest
  }
  return originalRequest
}

function changeResponse(request: RequestArguments, originalResponse: string): string {
  if (request.method === 'eth_chainId' && originalResponse === '0x1519') {
    console.log('sandigo request [0x1519] to [0x1]')
    return '0x1'
  }
  return originalResponse
}

function createListener(eventName: string, listener: (args: any) => void) {
  if (eventName === 'connect') {
    return onConnectListener(listener)
  } else if (eventName === 'chainChanged') {
    return onChainChangedListener(listener)
  }
  return listener
}

function onChainChangedListener(listener: (args: any) => void) {
  return (chainId: string) => {
    console.log('sandigo chainChanged', chainId)
    if (chainId === '0x1519') {
      console.log('sandigo chainChanged [0x1519] to [0x1]')
      listener('0x1')
    } else {
      listener(chainId)
    }
  }
}

function onConnectListener(listener: (args: any) => void) {
  return (connectInfo: ProviderConnectInfo) => {
    console.log('sandigo connect', connectInfo)
    if (connectInfo.chainId === '0x1519') {
      console.log('sandigo connect [0x1519] to [0x1]')
      listener({ chainId: '0x1' } as ProviderConnectInfo)
    } else {
      listener(connectInfo)
    }
  }
}
