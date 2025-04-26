import { EnvelopeIcon } from '@heroicons/react/24/outline'

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-8 flex justify-between">
          <div className="flex flex-col space-y-2">
            <div className="text-sm text-gray-500">Need help?</div>
            <a 
              href="mailto:hi@getlaunched.xyz" 
              className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
            >
              <EnvelopeIcon className="h-4 w-4" />
              hi@getlaunched.xyz
            </a>
          </div>
          <div className="text-sm text-gray-400">
            © {new Date().getFullYear()} LaunchPad. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  )
} 