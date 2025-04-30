import { EnvelopeIcon } from "@heroicons/react/24/outline";

export default function Footer() {
  return (
    <footer className="bg-white/20 border-t border-gray-100 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-8 flex flex-col sm:flex-row sm:justify-between items-center space-y-4 sm:space-y-0">
          <div className="flex flex-col items-center sm:items-start space-y-2">
            <div className="text-sm text-gray-500">Need help?</div>
            <a
              href="mailto:hi@getlaunched.xyz"
              className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
            >
              <EnvelopeIcon className="h-4 w-4" />
              hi@getlaunched.xyz
            </a>
          </div>
          <div className="text-sm text-gray-400 text-center sm:text-left">
            © {new Date().getFullYear()} LaunchPad. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
