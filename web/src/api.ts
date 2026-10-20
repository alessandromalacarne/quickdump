export interface Deck {
  id: string;
  name: string;
}

export interface DeckWithCount extends Deck {
  count: number;
}

export interface Dump {
  id: string;
  content: string;
  createdAt: string;
  decks: Deck[];
}

export type WorkflowEvent = 'dumpCreated' | 'deckDeleted';

export type WorkflowAction = 'script' | 'export';

export type RunStatus =
  'pending' | 'running' | 'success' | 'failed' | 'interrupted';

export interface Workflow {
  id: string;
  name: string;
  enabled: boolean;
  event: WorkflowEvent | null;
  cron: string | null;
  timezone: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  action: WorkflowAction;
  config: Record<string, unknown>;
  decks: Deck[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: RunStatus;
  trigger: Record<string, unknown>;
  exitCode: number | null;
  stdout: string | null;
  stderr: string | null;
  error: string | null;
  outputFile: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface ScriptRef {
  name: string;
  description?: string;
}

export interface WorkflowInput {
  name: string;
  event?: WorkflowEvent;
  cron?: string;
  timezone?: string;
  action: WorkflowAction;
  config: Record<string, unknown>;
  decks?: string[];
}

function jsonBody(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message) && message.length > 0) {
      return String(message[0]);
    }
    if (typeof message === 'string') {
      return message;
    }
  }
  return `Error ${status}`;
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(errorMessage(body, response.status));
  }
  return response;
}

export async function createDump(content: string): Promise<Dump> {
  const response = await request('/api/dumps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return (await response.json()) as Dump;
}

export async function listDumps(deck: string): Promise<Dump[]> {
  const response = await request(`/api/dumps?deck=${encodeURIComponent(deck)}`);
  return (await response.json()) as Dump[];
}

export async function updateDump(id: string, content: string): Promise<Dump> {
  const response = await request(`/api/dumps/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  return (await response.json()) as Dump;
}

export async function deleteDump(id: string): Promise<void> {
  await request(`/api/dumps/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function listDecks(): Promise<DeckWithCount[]> {
  const response = await request('/api/decks');
  return (await response.json()) as DeckWithCount[];
}

export async function deleteDeck(id: string): Promise<void> {
  await request(`/api/decks/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function listWorkflows(): Promise<Workflow[]> {
  const response = await request('/api/workflows');
  return (await response.json()) as Workflow[];
}

export async function createWorkflow(input: WorkflowInput): Promise<Workflow> {
  const response = await request('/api/workflows', jsonBody('POST', input));
  return (await response.json()) as Workflow;
}

export async function updateWorkflow(
  id: string,
  patch: Partial<WorkflowInput> & { enabled?: boolean },
): Promise<Workflow> {
  const response = await request(
    `/api/workflows/${encodeURIComponent(id)}`,
    jsonBody('PATCH', patch),
  );
  return (await response.json()) as Workflow;
}

export async function deleteWorkflow(id: string): Promise<void> {
  await request(`/api/workflows/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function listWorkflowRuns(id: string): Promise<WorkflowRun[]> {
  const response = await request(
    `/api/workflows/${encodeURIComponent(id)}/runs`,
  );
  return (await response.json()) as WorkflowRun[];
}

export async function runWorkflowNow(id: string): Promise<{ runId: string }> {
  const response = await request(
    `/api/workflows/${encodeURIComponent(id)}/run`,
    { method: 'POST' },
  );
  return (await response.json()) as { runId: string };
}

export async function listScripts(): Promise<ScriptRef[]> {
  const response = await request('/api/scripts');
  return (await response.json()) as ScriptRef[];
}
