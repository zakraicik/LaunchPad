import { useState } from 'react'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'

export default function PlatformAdmins () {
  const [admins] = useState([
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'Super Admin',
      status: 'Active',
      lastLogin: '2024-03-15'
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'Admin',
      status: 'Active',
      lastLogin: '2024-03-14'
    },
    {
      id: 3,
      name: 'Mike Johnson',
      email: 'mike@example.com',
      role: 'Moderator',
      status: 'Inactive',
      lastLogin: '2024-03-10'
    }
  ])

  return (
    <div className='p-6'>
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-2xl font-bold'>Platform Administrators</h1>
        <button className='bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2'>
          <PlusIcon className='h-5 w-5' />
          Add Admin
        </button>
      </div>

      <div className='bg-white rounded-lg shadow'>
        <table className='min-w-full'>
          <thead>
            <tr className='border-b'>
              <th className='px-6 py-3 text-left text-sm font-semibold'>
                Name
              </th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>
                Email
              </th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>
                Role
              </th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>
                Status
              </th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>
                Last Login
              </th>
              <th className='px-6 py-3 text-left text-sm font-semibold'>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {admins.map(admin => (
              <tr key={admin.id} className='border-b'>
                <td className='px-6 py-4'>{admin.name}</td>
                <td className='px-6 py-4'>{admin.email}</td>
                <td className='px-6 py-4'>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      admin.role === 'Super Admin'
                        ? 'bg-purple-100 text-purple-800'
                        : admin.role === 'Admin'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {admin.role}
                  </span>
                </td>
                <td className='px-6 py-4'>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      admin.status === 'Active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {admin.status}
                  </span>
                </td>
                <td className='px-6 py-4'>{admin.lastLogin}</td>
                <td className='px-6 py-4'>
                  <div className='flex gap-2'>
                    <button className='text-blue-600 hover:text-blue-800'>
                      <PencilIcon className='h-5 w-5' />
                    </button>
                    <button className='text-red-600 hover:text-red-800'>
                      <TrashIcon className='h-5 w-5' />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
