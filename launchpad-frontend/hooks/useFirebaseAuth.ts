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

  useEffect(() => {
    mounted.current = true
    console.log('useFirebaseAuth: Component mounted')
    return () => {
      mounted.current = false
      console.log('useFirebaseAuth: Component unmounted')
    }
  }, [])

  // Listen for auth state changes
  useEffect(() => {
    console.log('useFirebaseAuth: Setting up auth state listener')
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(auth, user => {
      console.log('useFirebaseAuth: Auth state changed', {
        user: user
          ? {
              uid: user.uid,
              email: user.email,
              isAnonymous: user.isAnonymous
            }
          : null
      })
      if (mounted.current) {
        setUser(user)
        setIsLoading(false)
      }
    })

    return () => {
      console.log('useFirebaseAuth: Cleaning up auth state listener')
      unsubscribe()
    }
  }, [])

  // Automatically sign in when wallet is connected
  useEffect(() => {
    const autoSignIn = async () => {
      console.log('useFirebaseAuth: Auto sign-in triggered', {
        address,
        hasWalletClient: !!walletClient,
        currentUser: getAuth().currentUser
      })

      if (!mounted.current) {
        console.log(
          'useFirebaseAuth: Component not mounted, skipping auto sign-in'
        )
        return
      }

      if (!address || !walletClient) {
        console.log(
          'useFirebaseAuth: No wallet connected, skipping auto sign-in'
        )
        if (mounted.current) {
          setIsLoading(false)
        }
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        // Check if we're already authenticated
        const auth = getAuth()
        const currentUser = auth.currentUser
        console.log('useFirebaseAuth: Current auth state', {
          isAuthenticated: !!currentUser,
          currentUser: currentUser
            ? {
                uid: currentUser.uid,
                email: currentUser.email,
                isAnonymous: currentUser.isAnonymous
              }
            : null
        })

        if (currentUser) {
          console.log(
            'useFirebaseAuth: Already authenticated, skipping sign-in'
          )
          if (mounted.current) {
            setIsLoading(false)
          }
          return
        }

        console.log('useFirebaseAuth: Attempting to sign in with wallet')
        await signInWithWallet()
      } catch (err) {
        console.error('useFirebaseAuth: Error during auto sign-in:', err)
        if (mounted.current) {
          setError(err instanceof Error ? err.message : 'Failed to sign in')
        }
      } finally {
        if (mounted.current) {
          setIsLoading(false)
        }
      }
    }

    autoSignIn()
  }, [address, walletClient])

  // Handle wallet disconnection
  useEffect(() => {
    if (!address && user) {
      console.log(
        'useFirebaseAuth: Wallet disconnected, signing out from Firebase'
      )
      const auth = getAuth()
      signOut(auth)
    }
  }, [address, user])

  const signInWithWallet = async () => {
    console.log('useFirebaseAuth: Starting signInWithWallet')

    if (!walletClient || !address) {
      console.log('useFirebaseAuth: No wallet connected')
      throw new Error('Please connect your wallet')
    }

    try {
      // Try to get the user document first
      const userDoc = doc(db, 'users', address.toLowerCase())
      console.log('useFirebaseAuth: Checking user document', {
        address: address.toLowerCase()
      })

      let userSnap
      try {
        userSnap = await getDoc(userDoc)
        console.log('useFirebaseAuth: User document exists:', userSnap.exists())
      } catch (err) {
        console.error('useFirebaseAuth: Error checking user document:', err)
        throw new Error('Failed to check user document')
      }

      // Create user document if it doesn't exist
      if (!userSnap.exists()) {
        console.log('useFirebaseAuth: Creating new user document')
        try {
          await setDoc(userDoc, {
            address: address.toLowerCase(),
            createdAt: new Date().toISOString()
          })
          console.log('useFirebaseAuth: User document created successfully')
        } catch (err) {
          console.error('useFirebaseAuth: Error creating user document:', err)
          throw new Error('Failed to create user document')
        }
      }

      // Get the custom token
      console.log('useFirebaseAuth: Requesting custom token')
      const response = await fetch('/api/auth/custom-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ address: address.toLowerCase() })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('useFirebaseAuth: Failed to get custom token:', errorData)
        throw new Error(errorData.error || 'Failed to generate custom token')
      }

      const { token } = await response.json()
      console.log('useFirebaseAuth: Received custom token')

      // Sign in with the custom token
      console.log('useFirebaseAuth: Signing in with custom token')
      const auth = getAuth()
      await signInWithCustomToken(auth, token)
      console.log('useFirebaseAuth: Successfully signed in with custom token')

      return true
    } catch (err) {
      console.error('useFirebaseAuth: Error in signInWithWallet:', err)
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
