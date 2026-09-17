import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export const MUTATION_KEYS = {
  rating: [
    'ratings',
    'teamMembers',
    'departmentRatingsSheet',
    'internopsSummary',
  ],
  proof: [
    'proofs',
    'tasks',
    'teamPendingProofs',
    'teamMembers',
    'taskAnalytics',
  ],
  task: ['tasks', 'proofs', 'teamMembers', 'taskAnalytics'],
};

export function useBackgroundCacheInvalidation(socket, customClient) {
  const queryClient = customClient || useQueryClient();

  useEffect(() => {
    if (!socket?.on) return undefined;

    const sync = (payload) => {
      const type =
        payload?.type || (payload?.table === 'ratings' ? 'rating' : 'proof');
      const keys = MUTATION_KEYS[type] || [
        'tasks',
        'proofs',
        'ratings',
        'teamMembers',
      ];
      keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    };

    socket.on('database:mutation', sync);
    socket.on('rating:updated', () => sync({ type: 'rating' }));
    socket.on('proof:updated', () => sync({ type: 'proof' }));

    return () => {
      socket.off?.('database:mutation', sync);
      socket.off?.('rating:updated');
      socket.off?.('proof:updated');
    };
  }, [socket, queryClient]);
}

export default useBackgroundCacheInvalidation;
