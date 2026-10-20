import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createWorkflow,
  deleteWorkflow,
  listWorkflowRuns,
  listWorkflows,
  listScripts,
  updateWorkflow,
  type Workflow,
} from '../api';
import { WorkflowsPage } from './WorkflowsPage';

vi.mock('../api', () => ({
  listWorkflows: vi.fn(),
  listScripts: vi.fn(),
  createWorkflow: vi.fn(),
  updateWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
  listWorkflowRuns: vi.fn(),
  runWorkflowNow: vi.fn(),
}));

const mockedListWorkflows = vi.mocked(listWorkflows);
const mockedListScripts = vi.mocked(listScripts);
const mockedCreateWorkflow = vi.mocked(createWorkflow);
const mockedUpdateWorkflow = vi.mocked(updateWorkflow);
const mockedDeleteWorkflow = vi.mocked(deleteWorkflow);
const mockedListRuns = vi.mocked(listWorkflowRuns);

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

function renderPage() {
  return render(
    <MemoryRouter>
      <WorkflowsPage />
    </MemoryRouter>,
  );
}

function scriptWorkflowName() {
  return screen.getByRole('textbox', { name: 'name' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListWorkflows.mockResolvedValue([workflow]);
  mockedListScripts.mockResolvedValue([
    { name: 'notify.sh', description: 'Notifies me' },
  ]);
  mockedListRuns.mockResolvedValue([]);
  mockedCreateWorkflow.mockResolvedValue({
    ...workflow,
    id: 'workflow-2',
    name: 'archived',
  });
  mockedUpdateWorkflow.mockResolvedValue({ ...workflow, enabled: false });
  mockedDeleteWorkflow.mockResolvedValue(undefined);
});

describe('WorkflowsPage', () => {
  it('lists the workflows with their trigger and action', async () => {
    renderPage();

    expect(
      await screen.findByRole('listitem', { name: /notify casa/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('when a dump is created · @casa · runs notify.sh'),
    ).toBeInTheDocument();
  });

  it('shows a loading state first', async () => {
    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('loading workflows…');

    await screen.findByRole('listitem', { name: /notify casa/ });
  });

  it('invites you to create one when there are none', async () => {
    mockedListWorkflows.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/no workflows yet/i)).toBeInTheDocument();
  });

  it('offers the scripts found on disk', async () => {
    renderPage();

    expect(
      await screen.findByRole('option', { name: 'notify.sh — Notifies me' }),
    ).toBeInTheDocument();
  });

  it('shows the API error when the workflows cannot be loaded', async () => {
    mockedListWorkflows.mockRejectedValue(new Error('Database is down'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is down',
    );
  });

  it('falls back to a generic message when loading fails without an error', async () => {
    mockedListWorkflows.mockRejectedValue('boom');
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the workflows',
    );
  });
});

describe('WorkflowsPage creation', () => {
  it('creates the workflow and adds it to the list', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('listitem', { name: /notify casa/ });

    await user.type(scriptWorkflowName(), 'archived');
    await user.type(screen.getByLabelText('decks'), 'trabalho');
    await user.selectOptions(screen.getByLabelText('script'), 'notify.sh');
    await user.click(screen.getByRole('button', { name: 'create workflow' }));

    expect(mockedCreateWorkflow).toHaveBeenCalledWith({
      name: 'archived',
      event: 'dumpCreated',
      action: 'script',
      config: { script: 'notify.sh' },
      decks: ['trabalho'],
    });
    expect(
      await screen.findByRole('listitem', { name: /archived/ }),
    ).toBeInTheDocument();
  });

  it('shows the API error instead of adding a broken workflow', async () => {
    const user = userEvent.setup();
    mockedCreateWorkflow.mockRejectedValue(new Error('cron must be valid'));
    renderPage();
    await screen.findByRole('listitem', { name: /notify casa/ });

    await user.type(scriptWorkflowName(), 'broken');
    await user.selectOptions(screen.getByLabelText('script'), 'notify.sh');
    await user.click(screen.getByRole('button', { name: 'create workflow' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'cron must be valid',
    );
    expect(
      screen.queryByRole('listitem', { name: /broken/ }),
    ).not.toBeInTheDocument();
  });
});

describe('WorkflowsPage toggling and deleting', () => {
  it('disables a workflow', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('listitem', { name: /notify casa/ });

    await user.click(
      screen.getByRole('checkbox', { name: 'enabled notify casa' }),
    );

    expect(mockedUpdateWorkflow).toHaveBeenCalledWith('workflow-1', {
      enabled: false,
    });
    expect(
      screen.getByRole('checkbox', { name: 'enabled notify casa' }),
    ).not.toBeChecked();
  });

  it('keeps the workflow and shows the error when toggling fails', async () => {
    const user = userEvent.setup();
    mockedUpdateWorkflow.mockRejectedValue(new Error('Workflow not found'));
    renderPage();
    await screen.findByRole('listitem', { name: /notify casa/ });

    await user.click(
      screen.getByRole('checkbox', { name: 'enabled notify casa' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Workflow not found',
    );
    expect(
      screen.getByRole('checkbox', { name: 'enabled notify casa' }),
    ).toBeChecked();
  });

  it('deletes a workflow', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('listitem', { name: /notify casa/ });

    await user.click(
      screen.getByRole('button', { name: 'Delete workflow notify casa' }),
    );

    expect(mockedDeleteWorkflow).toHaveBeenCalledWith('workflow-1');
    expect(await screen.findByText(/no workflows yet/i)).toBeInTheDocument();
  });

  it('keeps the workflow and shows the error when deleting fails', async () => {
    const user = userEvent.setup();
    mockedDeleteWorkflow.mockRejectedValue('boom');
    renderPage();
    await screen.findByRole('listitem', { name: /notify casa/ });

    await user.click(
      screen.getByRole('button', { name: 'Delete workflow notify casa' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not delete the workflow',
    );
    expect(
      screen.getByRole('listitem', { name: /notify casa/ }),
    ).toBeInTheDocument();
  });
});
