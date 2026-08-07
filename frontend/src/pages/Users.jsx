// frontend/src/pages/Users.jsx

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { fetchUsers } from '../services/userService';

const Users = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'created_at';
  const sortOrder = searchParams.get('sortOrder') || 'asc';

  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (debouncedSearch !== search) {
        const params = Object.fromEntries(searchParams);
        params.search = debouncedSearch;
        params.page = '1';
        setSearchParams(params);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [debouncedSearch, search, searchParams, setSearchParams]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', { page, limit, search, sortBy, sortOrder }],
    queryFn: () => fetchUsers({ page, limit, search, sortBy, sortOrder }),
    keepPreviousData: true,
  });

  const handleSort = (column) => {
    const newOrder = sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
    const params = Object.fromEntries(searchParams);
    params.sortBy = column;
    params.sortOrder = newOrder;
    setSearchParams(params);
  };

  const handlePageChange = (newPage) => {
    if (!data) return;
    if (newPage < 1 || newPage > data.totalPages) return;
    const params = Object.fromEntries(searchParams);
    params.page = newPage.toString();
    setSearchParams(params);
  };

  if (isLoading) return <div className="p-6">Loading users...</div>;
  if (error)
    return <div className="p-6 text-red-500">Error: {error.message}</div>;
  if (!data) return <div className="p-6">No users found</div>;

  return (
    <div className="p-6">
      {/* Search Input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          className="w-full max-w-md px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          defaultValue={search}
          onChange={(e) => setDebouncedSearch(e.target.value)}
        />
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="w-full bg-white shadow rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-6 py-3 text-left cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('name')}
              >
                Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left">Email</th>
              <th className="px-6 py-3 text-left">Role</th>
              <th
                className="px-6 py-3 text-left cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('created_at')}
              >
                Created Date{' '}
                {sortBy === 'created_at' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th
                className="px-6 py-3 text-left cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => handleSort('last_login')}
              >
                Last Login{' '}
                {sortBy === 'last_login' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((user) => (
              <tr key={user.id} className="border-t hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{user.name}</td>
                <td className="px-6 py-4">{user.email}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      user.role === 'ADMIN'
                        ? 'bg-red-100 text-red-800'
                        : user.role === 'MANAGER'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  {user.last_login
                    ? new Date(user.last_login).toLocaleDateString()
                    : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-2">
            <button
              className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
            >
              Previous
            </button>
            <span className="px-4 py-2">
              Page {page} of {data.totalPages}
            </span>
            <button
              className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === data.totalPages}
            >
              Next
            </button>
          </div>
          <div className="text-sm text-gray-500">
            Showing {(page - 1) * limit + 1} to{' '}
            {Math.min(page * limit, data.total)} of {data.total} users
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
