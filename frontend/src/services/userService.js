// frontend/src/services/userService.js

export const fetchUsers = async ({
  page,
  limit,
  search,
  sortBy,
  sortOrder,
}) => {
  const params = new URLSearchParams();
  params.append('page', page || 1);
  params.append('limit', limit || 20);
  if (search) params.append('search', search);
  if (sortBy) params.append('sortBy', sortBy);
  if (sortOrder) params.append('sortOrder', sortOrder);

  const response = await fetch(`/api/users?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }
  return response.json();
};
// frontend/src/services/userService.js

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api/v1';

export const fetchUsers = async ({
  page,
  limit,
  search,
  sortBy,
  sortOrder,
}) => {
  const params = new URLSearchParams();
  params.append('page', page || 1);
  params.append('limit', limit || 20);
  if (search) params.append('search', search);
  if (sortBy) params.append('sortBy', sortBy);
  if (sortOrder) params.append('sortOrder', sortOrder);

  const response = await fetch(`${API_BASE}/users?${params.toString()}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch users');
  }

  return response.json();
};
