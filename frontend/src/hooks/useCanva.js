import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';

export function useCanvaStatus() {
  return useQuery({
    queryKey: ['canvaStatus'],
    queryFn: async () => {
      const { data } = await api.get('/canva/status');
      return data;
    },
  });
}

export function useCanvaAuthUrl() {
  return useQuery({
    queryKey: ['canvaAuthUrl'],
    queryFn: async () => {
      const { data } = await api.get('/canva/auth/url');
      return data;
    },
  });
}

export function useCanvaDesigns() {
  return useQuery({
    queryKey: ['canvaDesigns'],
    queryFn: async () => {
      const { data } = await api.get('/canva/designs');
      return data;
    },
  });
}

export function useCanvaImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (designId) => {
      const { data } = await api.post(`/canva/import/${designId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useCanvaExport() {
  return useMutation({
    mutationFn: async (certificateId) => {
      const { data } = await api.post(`/canva/export/${certificateId}`);
      return data;
    },
  });
}

export function useCanvaBrands() {
  return useQuery({
    queryKey: ['canvaBrands'],
    queryFn: async () => {
      const { data } = await api.get('/canva/brands');
      return data;
    },
  });
}
