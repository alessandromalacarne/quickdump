import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDump,
  createWorkflow,
  deleteDump,
  deleteTag,
  deleteWorkflow,
  listDumps,
  listScripts,
  listTags,
  listWorkflowRuns,
  listWorkflows,
  runWorkflowNow,
  updateDump,
  updateWorkflow,
} from './api';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createDump', () => {
  it('posts the content and returns the created dump', async () => {
    const dump = {
      id: 'dump-1',
      content: 'olá #casa',
      createdAt: '2026-10-14T00:00:00.000Z',
      tags: [{ id: 'tag-1', name: 'casa' }],
    };
    const fetchMock = stubFetch(jsonResponse(dump, { status: 201 }));

    await expect(createDump('olá #casa')).resolves.toEqual(dump);

    expect(fetchMock).toHaveBeenCalledWith('/api/dumps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'olá #casa' }),
    });
  });

  it('rejects with the status when the body carries no message', async () => {
    stubFetch(jsonResponse({ statusCode: 400 }, { status: 400 }));

    await expect(createDump('nope')).rejects.toThrow('Error 400');
  });
});

describe('listDumps', () => {
  it('returns the dumps tagged with the given tag', async () => {
    const dumps = [
      {
        id: 'dump-1',
        content: 'buy coffee #casa',
        createdAt: '2026-10-14T12:00:00.000Z',
        tags: [{ id: 'tag-1', name: 'casa' }],
      },
    ];
    const fetchMock = stubFetch(jsonResponse(dumps));

    await expect(listDumps('casa')).resolves.toEqual(dumps);
    expect(fetchMock).toHaveBeenCalledWith('/api/dumps?tag=casa', undefined);
  });

  it('encodes the tag into the query', async () => {
    const fetchMock = stubFetch(jsonResponse([]));

    await listDumps('café');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dumps?tag=caf%C3%A9',
      undefined,
    );
  });

  it('throws the API message when the dumps cannot be loaded', async () => {
    stubFetch(jsonResponse({ message: 'Database is down' }, { status: 500 }));

    await expect(listDumps('casa')).rejects.toThrow('Database is down');
  });
});

describe('listTags', () => {
  it('returns the tags with their counts', async () => {
    const fetchMock = stubFetch(
      jsonResponse([
        { id: 'tag-1', name: 'casa', count: 2 },
        { id: 'tag-2', name: 'trabalho', count: 1 },
      ]),
    );

    await expect(listTags()).resolves.toEqual([
      { id: 'tag-1', name: 'casa', count: 2 },
      { id: 'tag-2', name: 'trabalho', count: 1 },
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/api/tags', undefined);
  });

  it('throws the API message when the request fails', async () => {
    stubFetch(jsonResponse({ message: 'Database is down' }, { status: 500 }));

    await expect(listTags()).rejects.toThrow('Database is down');
  });
});

describe('listTags error bodies', () => {
  it('takes the first message of a validation error', async () => {
    stubFetch(
      jsonResponse(
        { message: ['name must be longer', 'name is required'] },
        { status: 422 },
      ),
    );

    await expect(listTags()).rejects.toThrow('name must be longer');
  });

  it('falls back to the status for an empty message list', async () => {
    stubFetch(jsonResponse({ message: [] }, { status: 422 }));

    await expect(listTags()).rejects.toThrow('Error 422');
  });

  it('falls back to the status for a message that is not a string', async () => {
    stubFetch(jsonResponse({ message: 42 }, { status: 500 }));

    await expect(listTags()).rejects.toThrow('Error 500');
  });

  it('falls back to the status for a body without a message', async () => {
    stubFetch(jsonResponse({ error: 'nope' }, { status: 404 }));

    await expect(listTags()).rejects.toThrow('Error 404');
  });

  it('falls back to the status for a body that is not an object', async () => {
    stubFetch(jsonResponse('gateway timeout', { status: 504 }));

    await expect(listTags()).rejects.toThrow('Error 504');
  });

  it('falls back to the status when the body is not json', async () => {
    stubFetch(
      new Response('<html>oops</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    await expect(listTags()).rejects.toThrow('Error 502');
  });
});

describe('deleteTag', () => {
  it('sends a DELETE for the tag id', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await expect(deleteTag('tag-1')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/tags/tag-1', {
      method: 'DELETE',
    });
  });

  it('encodes the tag id into the path', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await deleteTag('tag/with space');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tags/tag%2Fwith%20space',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('throws the API message when the tag is gone', async () => {
    stubFetch(jsonResponse({ message: 'Tag not found' }, { status: 404 }));

    await expect(deleteTag('tag-1')).rejects.toThrow('Tag not found');
  });
});

const workflow = {
  id: 'workflow-1',
  name: 'notify casa',
  enabled: true,
  event: 'dumpCreated' as const,
  cron: null,
  timezone: 'America/Sao_Paulo',
  nextRunAt: null,
  lastRunAt: null,
  action: 'script' as const,
  config: { script: 'notify.sh' },
  tags: [{ id: 'tag-1', name: 'casa' }],
  createdAt: '2026-10-15T12:00:00.000Z',
  updatedAt: '2026-10-15T12:00:00.000Z',
};

describe('listWorkflows', () => {
  it('returns the workflows', async () => {
    const fetchMock = stubFetch(jsonResponse([workflow]));

    await expect(listWorkflows()).resolves.toEqual([workflow]);
    expect(fetchMock).toHaveBeenCalledWith('/api/workflows', undefined);
  });
});

describe('createWorkflow', () => {
  it('posts the workflow and returns it', async () => {
    const fetchMock = stubFetch(jsonResponse(workflow, { status: 201 }));
    const input = {
      name: 'notify casa',
      event: 'dumpCreated' as const,
      action: 'script' as const,
      config: { script: 'notify.sh' },
      tags: ['casa'],
    };

    await expect(createWorkflow(input)).resolves.toEqual(workflow);
    expect(fetchMock).toHaveBeenCalledWith('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  });

  it('throws the API message when the workflow is rejected', async () => {
    stubFetch(
      jsonResponse(
        { message: 'cron must be a valid cron expression' },
        { status: 400 },
      ),
    );

    await expect(
      createWorkflow({
        name: 'broken',
        cron: 'nope',
        action: 'export',
        config: {},
      }),
    ).rejects.toThrow('cron must be a valid cron expression');
  });
});

describe('updateWorkflow', () => {
  it('patches the workflow', async () => {
    const fetchMock = stubFetch(jsonResponse({ ...workflow, enabled: false }));

    await expect(
      updateWorkflow('workflow-1', { enabled: false }),
    ).resolves.toEqual({ ...workflow, enabled: false });
    expect(fetchMock).toHaveBeenCalledWith('/api/workflows/workflow-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
  });

  it('encodes the workflow id into the path', async () => {
    const fetchMock = stubFetch(jsonResponse(workflow));

    await updateWorkflow('workflow/1', { name: 'renamed' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/workflows/workflow%2F1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});

describe('deleteWorkflow', () => {
  it('sends a DELETE for the workflow id', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await expect(deleteWorkflow('workflow-1')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/workflows/workflow-1', {
      method: 'DELETE',
    });
  });
});

describe('listWorkflowRuns', () => {
  it('returns the runs of the workflow', async () => {
    const run = {
      id: 'run-1',
      workflowId: 'workflow-1',
      status: 'success' as const,
      trigger: { kind: 'manual' },
      exitCode: 0,
      stdout: 'notified',
      stderr: '',
      error: null,
      outputFile: null,
      startedAt: '2026-10-15T12:30:00.000Z',
      finishedAt: '2026-10-15T12:30:01.000Z',
    };
    const fetchMock = stubFetch(jsonResponse([run]));

    await expect(listWorkflowRuns('workflow-1')).resolves.toEqual([run]);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/workflows/workflow-1/runs',
      undefined,
    );
  });
});

describe('runWorkflowNow', () => {
  it('asks the API to run the workflow', async () => {
    const fetchMock = stubFetch(
      jsonResponse({ runId: 'run-1' }, { status: 202 }),
    );

    await expect(runWorkflowNow('workflow-1')).resolves.toEqual({
      runId: 'run-1',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/workflows/workflow-1/run', {
      method: 'POST',
    });
  });
});

describe('listScripts', () => {
  it('returns the scripts found on disk', async () => {
    const fetchMock = stubFetch(
      jsonResponse([{ name: 'notify.sh', description: 'Notifies me' }]),
    );

    await expect(listScripts()).resolves.toEqual([
      { name: 'notify.sh', description: 'Notifies me' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/api/scripts', undefined);
  });
});

describe('updateDump', () => {
  it('patches the content and returns the updated dump', async () => {
    const dump = {
      id: 'dump-1',
      content: '#casa buy tea',
      createdAt: '2026-10-14T00:00:00.000Z',
      tags: [{ id: 'tag-1', name: 'casa' }],
    };
    const fetchMock = stubFetch(jsonResponse(dump));

    await expect(updateDump('dump-1', '#casa buy tea')).resolves.toEqual(dump);

    expect(fetchMock).toHaveBeenCalledWith('/api/dumps/dump-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '#casa buy tea' }),
    });
  });

  it('encodes the dump id into the path', async () => {
    const fetchMock = stubFetch(
      jsonResponse({
        id: 'dump/with space',
        content: '#casa buy coffee',
        createdAt: '2026-10-14T00:00:00.000Z',
        tags: [{ id: 'tag-1', name: 'casa' }],
      }),
    );

    await updateDump('dump/with space', '#casa buy coffee');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dumps/dump%2Fwith%20space',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('throws the API message when the dump is gone', async () => {
    stubFetch(jsonResponse({ message: 'Dump not found' }, { status: 404 }));

    await expect(updateDump('dump-1', '#casa buy tea')).rejects.toThrow(
      'Dump not found',
    );
  });

  it('takes the first message of a validation error', async () => {
    stubFetch(
      jsonResponse(
        { message: ['content should not be empty'] },
        { status: 400 },
      ),
    );

    await expect(updateDump('dump-1', '')).rejects.toThrow(
      'content should not be empty',
    );
  });
});

describe('deleteDump', () => {
  it('sends a DELETE for the dump id', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await expect(deleteDump('dump-1')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/dumps/dump-1', {
      method: 'DELETE',
    });
  });

  it('encodes the dump id into the path', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));

    await deleteDump('dump/with space');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dumps/dump%2Fwith%20space',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('throws the API message when the dump is gone', async () => {
    stubFetch(jsonResponse({ message: 'Dump not found' }, { status: 404 }));

    await expect(deleteDump('dump-1')).rejects.toThrow('Dump not found');
  });
});
