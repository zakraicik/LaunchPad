import '@rainbow-me/rainbowkit/styles.css'
import type { AppProps } from 'next/app'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from '../config/web3'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import Layout from '../components/Layout'
import dynamic from 'next/dynamic'
import '../styles/globals.css'
import React, { useState, useEffect, createContext, useContext, ErrorInfo } from 'react'

// Extend Window interface to include our hydration flag
declare global {
  interface Window {
    __HYDRATION_COMPLETE__?: boolean;
  }
}

const queryClient = new QueryClient()

// Create a context for hydration state
export const HydrationContext = createContext({ isHydrated: false })
export const useHydration = () => useContext(HydrationContext)

// Dynamically import Toaster with no SSR
const Toaster = dynamic(
  () => import('react-hot-toast').then((c) => c.Toaster),
  { ssr: false }
)

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Hydration error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return null
    }
    return this.props.children
  }
}

function HydrationProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false)
  
  useEffect(() => {
    const handleRouteChange = () => {
      setIsHydrated(true)
      if (typeof window !== 'undefined') {
        window.__HYDRATION_COMPLETE__ = true
      }
    }

    // Initial hydration
    handleRouteChange()

    // Cleanup
    return () => {
      if (typeof window !== 'undefined') {
        window.__HYDRATION_COMPLETE__ = false
      }
    }
  }, [])
  
  return (
    <HydrationContext.Provider value={{ isHydrated }}>
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </HydrationContext.Provider>
  )
}

export default function App({ Component, pageProps }: AppProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <HydrationProvider>
            <Layout>
              {mounted && <Component {...pageProps} />}
              <Toaster position="bottom-right" />
            </Layout>
          </HydrationProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
