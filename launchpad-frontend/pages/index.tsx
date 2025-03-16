import ConnectButton from '../components/ConnectButton'

export default function Home () {
  return (
    <main className='min-h-screen bg-gray-100'>
      <div className='container mx-auto px-4 py-8'>
        <h1 className='text-4xl font-bold text-center mb-8'>LaunchPad dApp</h1>
        <ConnectButton />
        <div className='mt-8 text-center text-gray-600'>
          Connect your wallet to interact with the dApp
        </div>
      </div>
    </main>
  )
}
