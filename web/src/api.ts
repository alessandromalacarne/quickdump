export interface Tag {
  id: string;
  name: string;
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

export async function createDump(content: string): Promise<Dump> {
  const response = await fetch('/api/dumps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(errorMessage(body, response.status));
  }
  return (await response.json()) as Dump;
}
