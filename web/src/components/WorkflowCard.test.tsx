import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listWorkflowRuns, runWorkflowNow, type Workflow } from '../api';
import { WorkflowCard } from './WorkflowCard';

vi.mock('../api', () => ({
  listWorkflowRuns: vi.fn(),
  runWorkflowNow: vi.fn(),
}));

const mockedListRuns = vi.mocked(listWorkflowRuns);
const mockedRunNow = vi.mocked(runWorkflowNow);

const workflow: Workflow = {
  id: 'workflow-1',
  name: 'notify casa',
  enabled: true,
  event: 'dumpCreated',
  cron: null,
  timezone: 'America/Sao_Paulo',
  nextRunAt: null,
  lastRunAt: null,
  action: 'script',
  config: { script: 'notify.sh' },
  decks: [{ id: 'deck-1', name: 'casa' }],
  createdAt: '2026-10-15T12:00:00.000Z',
  updatedAt: '2026-10-15T12:00:00.000Z',
};

const successRun = {
  id: 'run-1',
  workflowId: 'workflow-1',
  status: 'success' as const,
  trigger: { kind: 'dumpCreated' },
  exitCode: 0,
  stdout: 'notified',
  stderr: '',
  error: null,
  outputFile: null,
  startedAt: '2026-10-15T12:30:00.000Z',
  finishedAt: '2026-10-15T12:30:01.000Z',
};

function renderCard(overrides: Partial<Workflow> = {}) {
  const props = {
    workflow: { ...workflow, ...overrides },
    onToggle: vi.fn(),
    onDelete: vi.fn(),
  };

  render(
    <ul>
      <WorkflowCard {...props} />
    </ul>,
  );

  return props;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListRuns.mockResolvedValue([]);
  mockedRunNow.mockResolvedValue({ runId: 'run-1' });
});

describe('WorkflowCard summary', () => {
  it('summarises the trigger and the action', async () => {
    renderCard();

    expect(screen.getByText('notify casa')).toBeInTheDocument();
    expect(
      screen.getByText('when a dump is created · @casa · runs notify.sh'),
    ).toBeInTheDocument();
  });

  it('summarises a scheduled export', async () => {
    renderCard({
      event: null,
      cron: '59 23 * * *',
      action: 'export',
      config: { window: 'day' },
      decks: [],
      nextRunAt: '2026-10-16T02:59:00.000Z',
    });

    expect(
      screen.getByText(
        'every 59 23 * * * (America/Sao_Paulo) · writes an export file',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/next run/)).toBeInTheDocument();
  });
});

describe('WorkflowCard runs', () => {
  it('reports that there are no runs yet', async () => {
    renderCard();

    expect(await screen.findByText('no runs yet')).toBeInTheDocument();
  });

  it('shows the outcome of the last runs', async () => {
    mockedListRuns.mockResolvedValue([
      successRun,
      {
        ...successRun,
        id: 'run-2',
        status: 'failed',
        exitCode: 3,
        stdout: '',
        error: 'Script exited with code 3',
      },
    ]);

    renderCard();

    expect(await screen.findByText('success')).toBeInTheDocument();
    expect(screen.getByText('notified')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('Script exited with code 3')).toBeInTheDocument();
  });

  it('shows the exported file of a run', async () => {
    mockedListRuns.mockResolvedValue([
      {
        ...successRun,
        outputFile: '/home/me/.quickdump/exports/quickdump-2026-10-15.txt',
      },
    ]);

    renderCard();

    expect(
      await screen.findByText(
        '/home/me/.quickdump/exports/quickdump-2026-10-15.txt',
      ),
    ).toBeInTheDocument();
  });
});

describe('WorkflowCard controls', () => {
  it('reports the workflow as enabled', () => {
    renderCard();

    expect(
      screen.getByRole('checkbox', { name: 'enabled notify casa' }),
    ).toBeChecked();
  });

  it('asks for a different enabled state', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderCard();

    await user.click(
      screen.getByRole('checkbox', { name: 'enabled notify casa' }),
    );

    expect(onToggle).toHaveBeenCalledWith('workflow-1', false);
  });

  it('asks for deletion', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderCard();

    await user.click(
      screen.getByRole('button', { name: 'Delete workflow notify casa' }),
    );

    expect(onDelete).toHaveBeenCalledWith('workflow-1');
  });
});

describe('WorkflowCard run now', () => {
  it('runs the workflow and shows the new run', async () => {
    const user = userEvent.setup();
    mockedListRuns.mockResolvedValueOnce([]).mockResolvedValue([successRun]);
    renderCard();
    await screen.findByText('no runs yet');

    await user.click(screen.getByRole('button', { name: /run workflow/i }));

    expect(mockedRunNow).toHaveBeenCalledWith('workflow-1');
    expect(await screen.findByText('success')).toBeInTheDocument();
    expect(mockedListRuns).toHaveBeenCalledTimes(2);
  });

  it('shows the error when the run cannot be started', async () => {
    const user = userEvent.setup();
    mockedRunNow.mockRejectedValue(new Error('Workflow not found'));
    renderCard();

    await user.click(screen.getByRole('button', { name: /run workflow/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Workflow not found',
    );
  });

  it('shows the error when the runs cannot be loaded', async () => {
    mockedListRuns.mockRejectedValue('boom');
    renderCard();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the runs',
    );
  });
});
