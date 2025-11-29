import { z } from 'zod';

// Ticket schema
export const TicketSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  details: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'done', 'blocked']),
  priority: z.enum(['low', 'medium', 'high']),
  phase: z.string().optional(),
  assignee: z.string().optional(),
  createdAt: z.string(),
  dueAt: z.string().optional(),
  tags: z.array(z.string()).default([]),
  docRefs: z.array(z.object({
    type: z.enum(['url', 'path']),
    value: z.string()
  })).default([]),
  acceptanceCriteria: z.array(z.string()).default([]),
  effortHours: z.number().optional()
});

export const TicketsDataSchema = z.object({
  version: z.string(),
  updatedAt: z.string(),
  tickets: z.array(TicketSchema)
});

export type Ticket = z.infer<typeof TicketSchema>;
export type TicketsData = z.infer<typeof TicketsDataSchema>;

// Onboarding request
export interface OnboardingRequest {
  tickets: Ticket[];
  role?: string;
  department?: string;
  additionalContext?: string;
}

// Onboarding plan response
export interface OnboardingPlan {
  roleSummary: string;
  objectives: string;
  detailedPlan: string;
  milestones: string;
  knowledgeRequirements: string;
  risks: string;
  raw: string;
}
