import { SYSTEM_PROMPT } from './systemPrompt';
import type { OnboardingRequest, OnboardingPlan, Ticket } from './types';

/**
 * ============================================
 * CONFIGURATION - ADD YOUR GEMINI API KEY HERE
 * ============================================
 * 
 * Option 1: Direct configuration (Quick start)
 * Paste your API key directly below between the quotes
 * 
 * Option 2: Environment variable (Recommended for teams)
 * Create a .env file and add: VITE_GEMINI_API_KEY=your_key_here
 * 
 * Get your API key:
 * 1. Go to https://ai.google.dev/
 * 2. Click "Get API Key" in Google AI Studio
 * 3. Create a new API key or use an existing one
 * 
 * Example: const GEMINI_API_KEY = 'AIzaSyD...';
 */
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyANCTKvdvow2hbneMNpr0CAW-D_h6nJx4g'; // <-- PASTE YOUR API KEY HERE

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Formats tickets into a structured prompt for the LLM
 */
function formatTicketsForPrompt(request: OnboardingRequest): string {
  const { tickets, role, department, additionalContext } = request;
  
  let prompt = '';
  
  // Add context if provided
  if (role) {
    prompt += `Role: ${role}\n`;
  }
  if (department) {
    prompt += `Department: ${department}\n`;
  }
  if (additionalContext) {
    prompt += `Additional Context: ${additionalContext}\n`;
  }
  
  prompt += '\n---\n\nTickets to process:\n\n';
  
  // Format each ticket
  tickets.forEach((ticket: Ticket, index: number) => {
    prompt += `Ticket ${index + 1}: ${ticket.id}\n`;
    prompt += `Title: ${ticket.title}\n`;
    prompt += `Summary: ${ticket.summary}\n`;
    
    if (ticket.details) {
      prompt += `Details: ${ticket.details}\n`;
    }
    
    prompt += `Priority: ${ticket.priority}\n`;
    prompt += `Status: ${ticket.status}\n`;
    
    if (ticket.phase) {
      prompt += `Phase: ${ticket.phase}\n`;
    }
    
    if (ticket.tags.length > 0) {
      prompt += `Tags: ${ticket.tags.join(', ')}\n`;
    }
    
    if (ticket.acceptanceCriteria.length > 0) {
      prompt += `Acceptance Criteria:\n`;
      ticket.acceptanceCriteria.forEach(criteria => {
        prompt += `  - ${criteria}\n`;
      });
    }
    
    if (ticket.docRefs.length > 0) {
      prompt += `References:\n`;
      ticket.docRefs.forEach(ref => {
        prompt += `  - [${ref.type}] ${ref.value}\n`;
      });
    }
    
    if (ticket.effortHours) {
      prompt += `Estimated Effort: ${ticket.effortHours} hours\n`;
    }
    
    prompt += '\n';
  });
  
  prompt += '---\n\nGenerate a complete onboarding plan based on the above tickets.';
  
  return prompt;
}

/**
 * Parses the LLM response into structured sections
 */
function parseOnboardingPlan(rawResponse: string): OnboardingPlan {
  // Store raw response
  const raw = rawResponse;
  
  // Extract sections using simple markers
  const sections = {
    roleSummary: extractSection(rawResponse, 'Role Summary', 'Onboarding Objectives'),
    objectives: extractSection(rawResponse, 'Onboarding Objectives', 'Detailed Onboarding Plan'),
    detailedPlan: extractSection(rawResponse, 'Detailed Onboarding Plan', 'Milestones'),
    milestones: extractSection(rawResponse, 'Milestones', 'Knowledge Requirements'),
    knowledgeRequirements: extractSection(rawResponse, 'Knowledge Requirements', 'Risks'),
    risks: extractSection(rawResponse, 'Risks', null),
  };
  
  return {
    ...sections,
    raw
  };
}

/**
 * Helper to extract content between two section headers
 */
function extractSection(text: string, startMarker: string, endMarker: string | null): string {
  const startIndex = text.indexOf(startMarker);
  if (startIndex === -1) return '';
  
  const contentStart = startIndex + startMarker.length;
  
  if (endMarker) {
    const endIndex = text.indexOf(endMarker, contentStart);
    if (endIndex === -1) {
      return text.substring(contentStart).trim();
    }
    return text.substring(contentStart, endIndex).trim();
  }
  
  return text.substring(contentStart).trim();
}

/**
 * Generates an onboarding plan by sending tickets to Gemini API
 */
export async function generateOnboardingPlan(request: OnboardingRequest): Promise<OnboardingPlan> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key is not configured. Please add your API key in src/lib/geminiService.ts');
  }
  
  // Format tickets into prompt
  const userPrompt = formatTicketsForPrompt(request);
  
  // Prepare API request
  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: SYSTEM_PROMPT + '\n\n' + userPrompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    }
  };
  
  // Call Gemini API
  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
  }
  
  const data = await response.json();
  
  // Extract text from response
  const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!generatedText) {
    throw new Error('No text generated from Gemini API');
  }
  
  // Parse into structured format
  return parseOnboardingPlan(generatedText);
}

/**
 * Check if API key is configured
 */
export function isApiKeyConfigured(): boolean {
  return GEMINI_API_KEY.length > 0;
}
