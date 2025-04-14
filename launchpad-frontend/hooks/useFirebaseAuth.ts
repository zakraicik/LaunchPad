import { useEffect, useState, useRef } from 'react'
import {
  getAuth,
  signInWithCustomToken,
  onAuthStateChanged,
  User
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
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (mounted.current) {
        setUser(user)
        setIsLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  // Automatically sign in when both wallet address and client are available
  useEffect(() => {
    const autoSignIn = async () => {
      if (address && walletClient && !user && mounted.current) {
        try {
          setIsLoading(true)
          await signInWithWallet()
        } catch (err) {
          console.error('Error during auto sign-in:', err)
        } finally {
          if (mounted.current) {
            setIsLoading(false)
          }
        }
      }
    }

    autoSignIn()
  }, [address, walletClient, user])

  const signInWithWallet = async () => {
    try {
      console.log('Firebase db instance exists:', !!db)

      if (!walletClient || !address) {
        throw new Error('Please connect your wallet')
      }

      console.log('Wallet connected')

      // Try to get the user document first
      const userDoc = doc(db, 'users', address.toLowerCase()) // Ensure consistent case
      let userSnap

      try {
        userSnap = await getDoc(userDoc)
        console.log('User document exists:', userSnap.exists())
      } catch (err) {
        console.error('Error checking user document:', err)
        throw new Error('Failed to check user document')
      }

      // Create user document if it doesn't exist
      if (!userSnap.exists()) {
        try {
          console.log(
            'Creating user document for address:',
            address.toLowerCase()
          )
          await setDoc(userDoc, {
            address: address.toLowerCase(), // Ensure consistent case
            createdAt: new Date().toISOString()
          })
          console.log('User document created successfully')
        } catch (err) {
          console.error('Error creating user document:', err)
          throw new Error('Failed to create user document')
        }
      }

      // Get the custom token
      try {
        console.log(
          'Requesting custom token for address:',
          address.toLowerCase()
        )
        const response = await fetch('/api/auth/custom-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ address: address.toLowerCase() }) // Ensure consistent case
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to generate custom token')
        }

        const { token } = await response.json()
        console.log('Custom token received successfully')

        // Sign in with the custom token
        const auth = getAuth()
        await signInWithCustomToken(auth, token)
        console.log('Successfully signed in with custom token')

        return true
      } catch (err) {
        console.error('Error in token generation or sign in:', err)
        throw err
      }
    } catch (err) {
      console.error('Error signing in with wallet:', err)
      setError(err instanceof Error ? err.message : 'Failed to sign in')
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
