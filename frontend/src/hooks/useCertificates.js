import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await api.get('/certificates/templates');
      return data;
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (template) => {
      const { data } = await api.post('/certificates/templates', template);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/certificates/templates/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useDeleteCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/certificates/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
    },
  });
}

export function useCertificates(filters) {
  return useQuery({
    queryKey: ['certificates', filters],
    queryFn: async () => {
      const { data } = await api.get('/certificates', { params: filters });
      return data;
    },
  });
}

export function useGenerateCertificate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/certificates/generate', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
    },
  });
}

export function useBulkGenerate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/certificates/bulk/generate', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
    },
  });
}

export function useBulkJobStatus(jobId) {
  return useQuery({
    queryKey: ['bulkJobStatus', jobId],
    queryFn: async () => {
      const { data } = await api.get(`/certificates/bulk/${jobId}`);
      return data;
    },
    enabled: !!jobId,
  });
}

export function useAIGenerateContent() {
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(
        '/certificates/ai/generate-content',
        payload
      );
      return data;
    },
  });
}

export function useAISuggestTemplate() {
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(
        '/certificates/ai/suggest-template',
        payload
      );
      return data;
    },
  });
}

export function useSeedTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/certificates/templates/seed', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useQuickGenerate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/certificates/quick-generate', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
    },
  });
}
