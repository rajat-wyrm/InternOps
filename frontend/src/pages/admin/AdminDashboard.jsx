import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/axios';
import { PageHeader, Table, Btn, Badge, Spinner } from '../../components/ui';

const ROLE_COLOR = {
  ADMIN: 'purple',
  SENIOR_TL: 'indigo',
  TL: 'blue',
  CAPTAIN: 'teal',
  INTERN: 'gray',
};

function initials(u) {
  const n = (u.full_name || u.email || '?').trim();
  return n
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['adminUsers', page],
    queryFn: () =>
      api.get(`/users?page=${page}&limit=10`).then((res) => res.data),
  });

  const inv = () => queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
  const suspendMut = useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/suspend`),
    onSuccess: inv,
  });
  const activateMut = useMutation({
    mutationFn: (id) => api.patch(`/users/${id}/activate`),
    onSuccess: inv,
  });
  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess: inv,
  });

  return (
    <div>
      <PageHeader
        title="User Management"
        icon="🛡️"
        subtitle="Manage all platform accounts"
      />

      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <Table head={['User', 'Role', 'Status', 'Actions']}>
            {data?.map((u) => (
              <tr
                key={u.id}
                className="border-t hover:bg-indigo-50/40 transition"
              >
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xs font-bold">
                      {initials(u)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">
                        {u.full_name || '—'}
                      </div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <Badge color={ROLE_COLOR[u.role] || 'gray'}>{u.role}</Badge>
                </td>
                <td className="p-3">
                  <Badge color={u.suspended ? 'red' : 'green'}>
                    {u.suspended ? 'Suspended' : 'Active'}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    {u.suspended ? (
                      <Btn
                        variant="success"
                        onClick={() => activateMut.mutate(u.id)}
                      >
                        Activate
                      </Btn>
                    ) : (
                      <Btn
                        variant="warning"
                        onClick={() => suspendMut.mutate(u.id)}
                      >
                        Suspend
                      </Btn>
                    )}
                    <Btn
                      variant="danger"
                      onClick={() => {
                        if (confirm('Delete this user?'))
                          deleteMut.mutate(u.id);
                      }}
                    >
                      Delete
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <div className="flex items-center gap-3 mt-4">
            <Btn
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ← Prev
            </Btn>
            <span className="text-sm text-gray-500">Page {page}</span>
            <Btn
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={!data || data.length < 10}
            >
              Next →
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}
