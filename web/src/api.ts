export interface Tag {
  id: string;
  name: string;
}

export interface TagWithCount extends Tag {
  count: number;
}

export interface Dump {
  id: string;
  content: string;
  createdAt: string;
  tags: Tag[];
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

export async function listTags(): Promise<TagWithCount[]> {
  const response = await request('/api/tags');
  return (await response.json()) as TagWithCount[];
}

export async function deleteTag(id: string): Promise<void> {
  await request(`/api/tags/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
