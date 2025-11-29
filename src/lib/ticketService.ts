import { TicketsDataSchema, type TicketsData } from './types';

/**
 * Fetches tickets from the public/tickets.json file
 */
export async function fetchTickets(): Promise<TicketsData> {
  const response = await fetch('/tickets.json');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch tickets: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Validate with zod schema
  const validatedData = TicketsDataSchema.parse(data);
  
  return validatedData;
}
