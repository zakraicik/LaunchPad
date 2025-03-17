import { Fragment, useState } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { useContractRead } from 'wagmi'
import { TokenRegistryABI } from '../../config/abis/TokenRegistry'
import { TokenRegistryAddress } from '../../config/contracts'
import { formatAddress } from '../../utils/format'

export interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  minimumContribution: bigint
}

interface TokenSelectorProps {
  selectedToken: Token | null
  onSelect: (token: Token) => void
  className?: string
}

export default function TokenSelector ({
  selectedToken,
  onSelect,
  className = ''
}: TokenSelectorProps) {
  const { data: supportedTokens = [] } = useContractRead({
    address: TokenRegistryAddress,
    abi: TokenRegistryABI,
    functionName: 'getAllSupportedTokens'
  })

  return (
    <Listbox value={selectedToken} onChange={onSelect}>
      <div className={`relative ${className}`}>
        <Listbox.Button className='relative w-full cursor-default rounded-md bg-white py-2.5 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm'>
          <span className='block truncate'>
            {selectedToken
              ? `${selectedToken.symbol} (${formatAddress(
                  selectedToken.address
                )})`
              : 'Select a token'}
          </span>
          <span className='pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2'>
            <ChevronUpDownIcon
              className='h-5 w-5 text-gray-400'
              aria-hidden='true'
            />
          </span>
        </Listbox.Button>
        <Transition
          as={Fragment}
          leave='transition ease-in duration-100'
          leaveFrom='opacity-100'
          leaveTo='opacity-0'
        >
          <Listbox.Options className='absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm'>
            {supportedTokens.map((tokenAddress: string) => (
              <Listbox.Option
                key={tokenAddress}
                className={({ active }) =>
                  `relative cursor-default select-none py-2 pl-10 pr-4 ${
                    active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                  }`
                }
                value={tokenAddress}
              >
                {({ selected }) => (
                  <>
                    <span
                      className={`block truncate ${
                        selected ? 'font-medium' : 'font-normal'
                      }`}
                    >
                      {formatAddress(tokenAddress)}
                    </span>
                    {selected ? (
                      <span className='absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600'>
                        <CheckIcon className='h-5 w-5' aria-hidden='true' />
                      </span>
                    ) : null}
                  </>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  )
}
