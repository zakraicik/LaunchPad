import { useEffect, useState } from 'react'
import { getLatestBlock, getContractEvents } from '../utils/blockchain'
import { CONTRACT_ADDRESSES } from '../config/blockchain'
import { useAccount } from 'wagmi'

export default function TestConnection () {
  const { address, isConnected } = useAccount()
  const [latestBlock, setLatestBlock] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const testConnection = async () => {
      try {
        // Test basic Alchemy connection
        const blockNumber = await getLatestBlock()
        setLatestBlock(blockNumber)

        // Test contract events
        // const events = await getContractEvents(
        //   CONTRACT_ADDRESSES.CAMPAIGN_FACTORY,
        //   'FactoryOperation'
        // )
        // console.log('Campaign events:', events)

        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
        setLoading(false)
      }
    }

    testConnection()
  }, [])

  if (loading) {
    return (
      <div className='min-h-screen bg-dark-950 flex items-center justify-center'>
        <div className='text-neon-blue'>Testing connection...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className='min-h-screen bg-dark-950 flex items-center justify-center'>
        <div className='text-red-500'>Error: {error}</div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-dark-950 p-8'>
      <div className='max-w-4xl mx-auto'>
        <h1 className='text-3xl font-display gradient-text mb-8'>
          Connection Test
        </h1>

        <div className='glass-card p-6 mb-6'>
          <h2 className='text-xl text-neon-blue mb-4'>Wallet Connection</h2>
          <p className='text-gray-300'>
            Status:{' '}
            <span className={isConnected ? 'text-neon-green' : 'text-red-500'}>
              {isConnected ? 'Connected' : 'Not Connected'}
            </span>
          </p>
          {address && (
            <p className='text-gray-300 mt-2'>
              Address:{' '}
              <span className='font-mono text-sm text-neon-green'>
                {address}
              </span>
            </p>
          )}
        </div>

        <div className='glass-card p-6 mb-6'>
          <h2 className='text-xl text-neon-blue mb-4'>Alchemy Connection</h2>
          <p className='text-gray-300'>
            Latest Block Number:{' '}
            <span className='text-white'>{latestBlock}</span>
          </p>
        </div>

        <div className='glass-card p-6'>
          <h2 className='text-xl text-neon-blue mb-4'>Contract Addresses</h2>
          <div className='space-y-2'>
            {Object.entries(CONTRACT_ADDRESSES).map(([name, address]) => (
              <div key={name} className='flex justify-between items-center'>
                <span className='text-gray-400'>{name}:</span>
                <span className='font-mono text-sm text-neon-green'>
                  {address}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
