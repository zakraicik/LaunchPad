import { useEffect, useState, useRef } from 'react'
import {
  getAuth,
  signInWithCustomToken,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth'
import { useWalletClient, useAccount } from 'wagmi'
import { db } from '../utils/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'

export function useFirebaseAuth () {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const { data: walletClient } = useWalletClient()
  const { address } = useAccount()
  const [mounted, setMounted] = useState(false)
  const auth = getAuth()

  // Initialize mounted state
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true)
    }, 0)
    
    return () => clearTimeout(timer)
  }, [])

  // Handle auth state changes
  useEffect(() => {
    if (!mounted) return

    let unsubscribe: () => void

    const setupAuthListener = () => {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user)
        setIsLoading(false)
      })
    }

    setupAuthListener()

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [auth, mounted])

  // Automatically sign in when wallet is connected
  useEffect(() => {
    if (!mounted) return

    const autoSignIn = async () => {
      if (!address || !walletClient) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        // Check if we're already authenticated
        const currentUser = auth.currentUser
        if (currentUser) {
          setIsLoading(false)
          return
        }

        await signInWithWallet()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to sign in')
      } finally {
        setIsLoading(false)
      }
    }

    autoSignIn()
  }, [address, walletClient, mounted])

  // Handle wallet disconnection
  useEffect(() => {
    if (!mounted) return

    if (!address && user) {
      const auth = getAuth()
      signOut(auth)
    }
  }, [address, user, mounted])

  const signInWithWallet = async () => {
    if (!walletClient || !address) {
      throw new Error('Please connect your wallet')
    }

    try {
      // Try to get the user document first
      const userDoc = doc(db, 'users', address.toLowerCase())
      let userSnap
      try {
        userSnap = await getDoc(userDoc)
      } catch (err) {
        throw new Error('Failed to check user document')
      }

      // Create user document if it doesn't exist
      if (!userSnap.exists()) {
        try {
          await setDoc(userDoc, {
            address: address.toLowerCase(),
            createdAt: new Date().toISOString()
          })
        } catch (err) {
          throw new Error('Failed to create user document')
        }
      }

      // Get the custom token
      const response = await fetch('/api/auth/custom-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ address: address.toLowerCase() })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate custom token')
      }

      const { token } = await response.json()

      // Sign in with the custom token
      const auth = getAuth()
      await signInWithCustomToken(auth, token)

      return true
    } catch (err) {
      throw err
    }
  }

  return {
    user,
    isLoading,
    error
  }
}
