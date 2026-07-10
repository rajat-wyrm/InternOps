import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';

// ============================================================
// Validation
// ============================================================

export function useValidateCertificate() {
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/ai-certificates/validate', payload);
      return data;
    },
  });
}

// ============================================================
// Text Generation
// ============================================================

export function useGenerateAchievement() {
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(
        '/ai-certificates/generate-achievement',
        payload
      );
      return data;
    },
  });
}

export function useGenerateContent() {
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(
        '/ai-certificates/generate-content',
        payload
      );
      return data;
    },
  });
}

// ============================================================
// Template Matching
// ============================================================

export function useMatchTemplate() {
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(
        '/ai-certificates/match-template',
        payload
      );
      return data;
    },
  });
}

// ============================================================
// Certificate Rendering
// ============================================================

export function useRenderCertificatePNG() {
  return useMutation({
    mutationFn: async (params) => {
      const { data } = await api.get('/ai-certificates/certificate-png', {
        params,
      });
      return data;
    },
  });
}

// ============================================================
// Full Pipeline
// ============================================================

export function useFullPipeline() {
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/ai-certificates/pipeline', payload);
      return data;
    },
  });
}

// ============================================================
// Bulk AI Generation
// ============================================================

export function useBulkAIGenerate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(
        '/ai-certificates/bulk-generate',
        payload
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
    },
  });
}

export function useBulkAIJobStatus(jobId) {
  return useQuery({
    queryKey: ['bulkAIJobStatus', jobId],
    queryFn: async () => {
      const { data } = await api.get(`/ai-certificates/bulk-generate/${jobId}`);
      return data;
    },
    enabled: !!jobId,
  });
}

// ============================================================
// Tone Customizer
// ============================================================

export function useToneCustomize() {
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(
        '/ai-certificates/tone-customize',
        payload
      );
      return data;
    },
  });
}

export function useAvailableTones() {
  return useQuery({
    queryKey: ['availableTones'],
    queryFn: async () => {
      const { data } = await api.get('/ai-certificates/tones');
      return data;
    },
  });
}

// ============================================================
// Multi-Language Support
// ============================================================

export function useGenerateMultilanguage() {
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(
        '/ai-certificates/generate-multilanguage',
        payload
      );
      return data;
    },
  });
}

export function useSupportedLanguages() {
  return useQuery({
    queryKey: ['supportedLanguages'],
    queryFn: async () => {
      const { data } = await api.get('/ai-certificates/languages');
      return data;
    },
  });
}

// ============================================================
// Design Suggestions
// ============================================================

export function useDesignSuggest() {
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(
        '/ai-certificates/design-suggest',
        payload
      );
      return data;
    },
  });
}

export function useDesignTemplates() {
  return useQuery({
    queryKey: ['designTemplates'],
    queryFn: async () => {
      const { data } = await api.get('/ai-certificates/design-templates');
      return data;
    },
  });
}

// ============================================================
// Certificate Preview
// ============================================================

export function useCertificatePreview() {
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/ai-certificates/preview', payload);
      return data;
    },
  });
}
