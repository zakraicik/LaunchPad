import { ConnectButton } from '@rainbow-me/rainbowkit'

export const CustomConnectButton = () => {
  return (
    <ConnectButton
      label='Sign In'
      accountStatus={{
        smallScreen: 'avatar',
        largeScreen: 'full'
      }}
      chainStatus={{
        smallScreen: 'icon',
        largeScreen: 'full'
      }}
      showBalance={false}
    />
  )
}

export default CustomConnectButton
