import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { createDump, listDumps, listTags } from './api';

vi.mock('./api', () => ({
  createDump: vi.fn(),
  deleteDump: vi.fn(),
  deleteTag: vi.fn(),
  listDumps: vi.fn(),
  listTags: vi.fn(),
  updateDump: vi.fn(),
}));

const mockedCreateDump = vi.mocked(createDump);
const mockedListDumps = vi.mocked(listDumps);
const mockedListTags = vi.mocked(listTags);

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const casaDump = {
  id: 'dump-1',
  content: 'buy coffee #casa',
  createdAt: '2026-10-10T12:00:00.000Z',
  tags: [{ id: 'tag-1', name: 'casa' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedCreateDump.mockResolvedValue({
    id: 'dump-1',
    content: '#casa buy coffee',
    createdAt: '2026-10-10T12:00:00.000Z',
    tags: [{ id: 'tag-1', name: 'casa' }],
  });
  mockedListDumps.mockResolvedValue([]);
  mockedListTags.mockResolvedValue([]);
});

describe('composer', () => {
  it('opens with the composer focused', () => {
    renderApp();

    expect(screen.getByRole('textbox', { name: /dump/i })).toHaveFocus();
  });

  it('sends with Enter, clears the field and confirms', async () => {
    const user = userEvent.setup();
    renderApp();
    const textarea = screen.getByRole('textbox', { name: /dump/i });

    await user.type(textarea, '#casa buy coffee{Enter}');

    expect(mockedCreateDump).toHaveBeenCalledWith('#casa buy coffee');
    expect(textarea).toHaveValue('');
    expect(await screen.findByText(/saved/i)).toBeInTheDocument();
  });

  it('Shift+Enter breaks the line instead of sending', async () => {
    const user = userEvent.setup();
    renderApp();
    const textarea = screen.getByRole('textbox', { name: /dump/i });

    await user.type(textarea, '#casa line one{Shift>}{Enter}{/Shift}line two');

    expect(mockedCreateDump).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('#casa line one\nline two');
  });

  it('clicking anywhere on the block focuses the field', async () => {
    const user = userEvent.setup();
    renderApp();
    const textarea = screen.getByRole('textbox', { name: /dump/i });
    textarea.blur();

    await user.click(screen.getByText(/enter sends/i));

    expect(textarea).toHaveFocus();
  });
});

describe('composer errors', () => {
  it('warns when the tag is missing and does not call the API', async () => {
    const user = userEvent.setup();
    renderApp();
    const textarea = screen.getByRole('textbox', { name: /dump/i });

    await user.type(textarea, 'text without a tag{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Include at least one #tag in the dump',
    );
    expect(mockedCreateDump).not.toHaveBeenCalled();
  });

  it('API error keeps the text and shows the message', async () => {
    const user = userEvent.setup();
    mockedCreateDump.mockRejectedValue(new Error('Database is down'));
    renderApp();
    const textarea = screen.getByRole('textbox', { name: /dump/i });

    await user.type(textarea, '#casa algo{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is down',
    );
    expect(textarea).toHaveValue('#casa algo');
  });
});

describe('tag pages', () => {
  it('opens the tags page straight from the URL', async () => {
    mockedListTags.mockResolvedValue([{ id: 'tag-1', name: 'casa', count: 2 }]);
    renderApp('/tags');

    expect(
      await screen.findByRole('listitem', { name: /casa/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: /dump/i }),
    ).not.toBeInTheDocument();
  });

  it('opens a tag page straight from the URL', async () => {
    mockedListDumps.mockResolvedValue([casaDump]);
    renderApp('/tag/casa');

    expect(await screen.findByText('buy coffee #casa')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'New dump' })).toHaveValue(
      '#casa ',
    );
  });

  it('opens the dumps of a tag clicked on the tags page', async () => {
    const user = userEvent.setup();
    mockedListTags.mockResolvedValue([{ id: 'tag-1', name: 'casa', count: 2 }]);
    mockedListDumps.mockResolvedValue([casaDump]);
    renderApp('/tags');

    await user.click(await screen.findByRole('link', { name: /#casa/ }));

    expect(mockedListDumps).toHaveBeenCalledWith('casa');
    expect(await screen.findByText('buy coffee #casa')).toBeInTheDocument();
  });
});

describe('navigation', () => {
  it('navigates between the composer and the tags page', async () => {
    const user = userEvent.setup();
    mockedListTags.mockResolvedValue([{ id: 'tag-1', name: 'casa', count: 2 }]);
    renderApp();

    const tagsLink = screen.getByRole('link', { name: 'tags' });
    const dumpLink = screen.getByRole('link', { name: 'dump' });
    expect(dumpLink.className).toContain('text-ink');
    expect(tagsLink.className).toContain('text-ink-faint');

    await user.click(tagsLink);

    expect(
      await screen.findByRole('listitem', { name: /casa/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'tags' }).className).toContain(
      'text-ink',
    );
    expect(screen.getByRole('link', { name: 'dump' }).className).toContain(
      'text-ink-faint',
    );

    await user.click(screen.getByRole('link', { name: 'dump' }));

    expect(screen.getByRole('textbox', { name: /dump/i })).toBeInTheDocument();
  });

  it('keeps the tags link highlighted on a tag page', async () => {
    mockedListDumps.mockResolvedValue([casaDump]);
    renderApp('/tag/casa');

    await screen.findByText('buy coffee #casa');

    expect(
      screen.getByRole('link', { name: 'tags' }).classList.contains('text-ink'),
    ).toBe(true);
    expect(
      screen.getByRole('link', { name: 'dump' }).classList.contains('text-ink'),
    ).toBe(false);
  });
});
