import { ConnectButton as RainbowConnectButton } from '@rainbow-me/rainbowkit'

export const ConnectButton = () => {
  return (
    <div className='flex justify-center items-center'>
      <RainbowConnectButton.Custom>
        {({
          account,
          chain,
          openAccountModal,
          openChainModal,
          openConnectModal,
          mounted
        }) => {
          const ready = mounted

          if (!ready) {
            return null
          }

          if (!account) {
            return (
              <button
                onClick={openConnectModal}
                className='text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors'
              >
                Connect
              </button>
            )
          }

          if (chain?.unsupported) {
            return (
              <button
                onClick={openChainModal}
                className='text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-red-700 transition-colors'
              >
                Wrong Network
              </button>
            )
          }

          return (
            <div className='flex items-center gap-2'>
              <button
                onClick={openChainModal}
                className='text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-medium hover:bg-blue-100 transition-colors'
              >
                {chain?.hasIcon && chain.iconUrl && (
                  <div className='mr-1 h-4 w-4 inline-block'>
                    <img
                      alt={chain.name ?? 'Chain icon'}
                      src={chain.iconUrl}
                      className='h-4 w-4'
                    />
                  </div>
                )}
                {chain?.name}
              </button>

              <button
                onClick={openAccountModal}
                className='text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-medium hover:bg-blue-100 transition-colors'
              >
                {account.displayName}
              </button>
            </div>
          )
        }}
      </RainbowConnectButton.Custom>
    </div>
  )
}

export default ConnectButton
