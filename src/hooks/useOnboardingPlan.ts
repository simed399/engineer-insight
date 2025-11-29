import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchTickets } from '../lib/ticketService';
import { generateOnboardingPlan, isApiKeyConfigured } from '../lib/geminiService';
import type { OnboardingRequest, OnboardingPlan } from '../lib/types';

/**
 * Hook to fetch tickets from JSON file
 */
export function useTickets() {
  return useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to generate onboarding plan from tickets
 */
export function useGenerateOnboardingPlan() {
  return useMutation<OnboardingPlan, Error, OnboardingRequest>({
    mutationFn: generateOnboardingPlan,
  });
}

/**
 * Hook to check if API key is configured
 */
export function useApiKeyStatus() {
  return {
    isConfigured: isApiKeyConfigured()
  };
}
