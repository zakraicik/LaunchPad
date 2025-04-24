import React, { useState, useRef, useEffect } from 'react'
import { ClipboardIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline'

interface CampaignDetailsProps {
  description?: string
  category?: string
  campaignAddress?: string
  owner?: string
  githubUrl?: string
}

export default function CampaignDetails({
  description,
  category,
  campaignAddress,
  owner,
  githubUrl
}: CampaignDetailsProps) {
  const [showAddressPopover, setShowAddressPopover] = useState(false)
  const [showOwnerPopover, setShowOwnerPopover] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [copiedOwner, setCopiedOwner] = useState(false)
  const addressPopoverRef = useRef<HTMLDivElement>(null)
  const ownerPopoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addressPopoverRef.current && !addressPopoverRef.current.contains(event.target as Node)) {
        setShowAddressPopover(false)
      }
      if (ownerPopoverRef.current && !ownerPopoverRef.current.contains(event.target as Node)) {
        setShowOwnerPopover(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCopyAddress = async (address: string, isCampaignAddress: boolean) => {
    await navigator.clipboard.writeText(address)
    if (isCampaignAddress) {
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
    } else {
      setCopiedOwner(true)
      setTimeout(() => setCopiedOwner(false), 2000)
    }
  }

  const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`

  return (
    <div className='space-y-6'>
      {/* Main Description - Only render if description is provided */}
      {description && (
        <div className='prose max-w-none'>
          <p className='text-gray-600'>{description}</p>
        </div>
      )}

      {/* Additional Details */}
      <div className='bg-gray-50 rounded-lg p-3 md:p-4'>
        <h3 className='text-sm font-medium text-gray-900 mb-3 md:mb-4'>Campaign Information</h3>
        <div className='space-y-3 md:space-y-4'>
          {category && (
            <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-0'>
              <span className='text-xs md:text-sm text-gray-500'>Category</span>
              <div className='w-fit'>
                <span className='inline-block px-2 py-1 text-xs md:text-sm font-medium text-blue-600 bg-blue-50 rounded-full'>
                  {category}
                </span>
              </div>
            </div>
          )}
          {githubUrl && (
            <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-0'>
              <span className='text-xs md:text-sm text-gray-500'>GitHub Repository</span>
              <a
                href={githubUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='text-xs md:text-sm font-medium text-blue-600 hover:text-blue-800'
              >
                View on GitHub →
              </a>
            </div>
          )}
          {campaignAddress && (
            <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-0 relative'>
              <span className='text-xs md:text-sm text-gray-500'>Contract Address</span>
              <div ref={addressPopoverRef}>
                <button
                  onClick={() => setShowAddressPopover(!showAddressPopover)}
                  className='text-xs md:text-sm font-medium font-mono text-blue-600 hover:text-blue-800'
                >
                  {formatAddress(campaignAddress)}
                </button>
                {showAddressPopover && (
                  <div className='absolute right-0 mt-2 w-[calc(100vw-2rem)] md:w-72 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10'>
                    <div className='p-3 md:p-4'>
                      <div className='flex items-center justify-between mb-2'>
                        <span className='text-xs md:text-sm font-medium text-gray-900'>Contract Address</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopyAddress(campaignAddress, true)
                          }}
                          className='text-gray-400 hover:text-gray-600'
                        >
                          {copiedAddress ? (
                            <ClipboardDocumentCheckIcon className='h-4 md:h-5 w-4 md:w-5 text-green-500' />
                          ) : (
                            <ClipboardIcon className='h-4 md:h-5 w-4 md:w-5' />
                          )}
                        </button>
                      </div>
                      <p className='text-xs md:text-sm font-mono mb-2 text-gray-600 break-all'>{campaignAddress}</p>
                      <a
                        href={`https://basescan.org/address/${campaignAddress}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-xs md:text-sm text-blue-600 hover:text-blue-800'
                      >
                        View on Basescan →
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {owner && (
            <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-0 relative'>
              <span className='text-xs md:text-sm text-gray-500'>Campaign Owner</span>
              <div ref={ownerPopoverRef}>
                <button
                  onClick={() => setShowOwnerPopover(!showOwnerPopover)}
                  className='text-xs md:text-sm font-medium font-mono text-blue-600 hover:text-blue-800'
                >
                  {formatAddress(owner)}
                </button>
                {showOwnerPopover && (
                  <div className='absolute right-0 mt-2 w-[calc(100vw-2rem)] md:w-72 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10'>
                    <div className='p-3 md:p-4'>
                      <div className='flex items-center justify-between mb-2'>
                        <span className='text-xs md:text-sm font-medium text-gray-900'>Owner Address</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCopyAddress(owner, false)
                          }}
                          className='text-gray-400 hover:text-gray-600'
                        >
                          {copiedOwner ? (
                            <ClipboardDocumentCheckIcon className='h-4 md:h-5 w-4 md:w-5 text-green-500' />
                          ) : (
                            <ClipboardIcon className='h-4 md:h-5 w-4 md:w-5' />
                          )}
                        </button>
                      </div>
                      <p className='text-xs md:text-sm font-mono mb-2 text-gray-600 break-all'>{owner}</p>
                      <a
                        href={`https://basescan.org/address/${owner}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-xs md:text-sm text-blue-600 hover:text-blue-800'
                      >
                        View on Basescan →
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 