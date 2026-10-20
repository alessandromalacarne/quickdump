import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowForm } from './WorkflowForm';

const scripts = [
  { name: 'notify.sh', description: 'Notifies me' },
  { name: 'archive.sh' },
];

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(<WorkflowForm scripts={scripts} onSubmit={onSubmit} />);
  return onSubmit;
}

const submit = () => screen.getByRole('button', { name: 'create workflow' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('creating a workflow on an event', () => {
  it('sends the event, the deck scope and the script', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.type(screen.getByLabelText('name'), 'notify casa');
    await user.type(screen.getByLabelText('decks'), '@casa, financas');
    await user.selectOptions(screen.getByLabelText('script'), 'notify.sh');
    await user.click(submit());

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'notify casa',
      event: 'dumpCreated',
      action: 'script',
      config: { script: 'notify.sh' },
      decks: ['casa', 'financas'],
    });
  });

  it('describes the scripts on offer', () => {
    renderForm();

    expect(
      screen.getByRole('option', { name: 'notify.sh — Notifies me' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'archive.sh' }),
    ).toBeInTheDocument();
  });

  it('lets the event be changed', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.type(screen.getByLabelText('name'), 'on deck deletion');
    await user.selectOptions(screen.getByLabelText('event'), 'deckDeleted');
    await user.selectOptions(screen.getByLabelText('script'), 'archive.sh');
    await user.click(submit());

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'deckDeleted' }),
    );
  });

  it('leaves the deck scope empty when nothing is typed', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.type(screen.getByLabelText('name'), 'everything');
    await user.selectOptions(screen.getByLabelText('script'), 'notify.sh');
    await user.click(submit());

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ decks: [] }),
    );
  });

  it('clears the name after a successful save', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('name'), 'notify casa');
    await user.selectOptions(screen.getByLabelText('script'), 'notify.sh');
    await user.click(submit());

    expect(screen.getByLabelText('name')).toHaveValue('');
  });
});

describe('creating a workflow on a schedule', () => {
  it('sends the cron, the timezone and the export window', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.type(screen.getByLabelText('name'), 'daily export');
    await user.click(screen.getByRole('radio', { name: /on a schedule/i }));
    await user.clear(screen.getByLabelText('cron'));
    await user.type(screen.getByLabelText('cron'), '0 23 * * *');
    await user.click(screen.getByRole('radio', { name: /export file/i }));
    await user.selectOptions(screen.getByLabelText('window'), 'day');
    await user.click(submit());

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'daily export',
      cron: '0 23 * * *',
      timezone: expect.any(String),
      action: 'export',
      config: { window: 'day' },
      decks: [],
    });
  });

  it('hides the cron fields while the trigger is an event', () => {
    renderForm();

    expect(screen.queryByLabelText('cron')).not.toBeInTheDocument();
    expect(screen.getByLabelText('event')).toBeInTheDocument();
  });
});

describe('form validation', () => {
  it('asks for a name', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Give the workflow a name',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('asks for a script', async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm();

    await user.type(screen.getByLabelText('name'), 'no script');
    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a script',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the API error and keeps the name', async () => {
    const user = userEvent.setup();
    renderForm(vi.fn().mockRejectedValue(new Error('cron must be valid')));

    await user.type(screen.getByLabelText('name'), 'broken');
    await user.selectOptions(screen.getByLabelText('script'), 'notify.sh');
    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'cron must be valid',
    );
    expect(screen.getByLabelText('name')).toHaveValue('broken');
  });

  it('explains when the scripts directory is empty', async () => {
    render(<WorkflowForm scripts={[]} onSubmit={vi.fn()} />);

    expect(await screen.findByText(/no scripts found/i)).toBeInTheDocument();
  });
});
