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
  const mounted = useRef(false)
  const auth = getAuth()

  // Initialize mounted ref
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Handle auth state changes
  useEffect(() => {
    let unsubscribe: () => void

    const setupAuthListener = () => {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (!mounted.current) return
        
        // Use requestAnimationFrame to ensure we're not updating state during render
        requestAnimationFrame(() => {
          if (mounted.current) {
            setUser(user)
            setIsLoading(false)
          }
        })
      })
    }

    setupAuthListener()

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [auth])

  // Automatically sign in when wallet is connected
  useEffect(() => {
    const autoSignIn = async () => {
      if (!mounted.current) {
        return
      }

      if (!address || !walletClient) {
        if (mounted.current) {
          setIsLoading(false)
        }
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        // Check if we're already authenticated
        const currentUser = auth.currentUser
        if (currentUser) {
          if (mounted.current) {
            setIsLoading(false)
          }
          return
        }

        await signInWithWallet()
      } catch (err) {
        if (mounted.current) {
          setError(err instanceof Error ? err.message : 'Failed to sign in')
        }
      } finally {
        if (mounted.current) {
          setIsLoading(false)
        }
      }
    }

    // Use requestAnimationFrame to ensure we're not updating state during render
    requestAnimationFrame(() => {
      autoSignIn()
    })
  }, [address, walletClient])

  // Handle wallet disconnection
  useEffect(() => {
    if (!address && user) {
      const auth = getAuth()
      signOut(auth)
    }
  }, [address, user])

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
    signInWithWallet,
    isLoading,
    error,
    user
  }
}
