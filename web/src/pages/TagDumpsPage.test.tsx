import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDump, deleteDump, listDumps, updateDump } from '../api';
import { TagDumpsPage } from './TagDumpsPage';

vi.mock('../api', () => ({
  createDump: vi.fn(),
  deleteDump: vi.fn(),
  listDumps: vi.fn(),
  updateDump: vi.fn(),
}));

const mockedCreateDump = vi.mocked(createDump);
const mockedDeleteDump = vi.mocked(deleteDump);
const mockedListDumps = vi.mocked(listDumps);
const mockedUpdateDump = vi.mocked(updateDump);

const dumps = [
  {
    id: 'dump-1',
    content: 'buy coffee #casa',
    createdAt: '2026-10-14T12:00:00.000Z',
    tags: [{ id: 'tag-1', name: 'casa' }],
  },
  {
    id: 'dump-2',
    content: 'fix the sink\n#casa #home',
    createdAt: '2026-10-13T09:30:00.000Z',
    tags: [
      { id: 'tag-1', name: 'casa' },
      { id: 'tag-2', name: 'home' },
    ],
  },
];

function renderPage(path = '/tag/casa') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tag/:tag" element={<TagDumpsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function findCards() {
  return screen.findAllByRole('listitem');
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListDumps.mockResolvedValue(dumps);
  mockedDeleteDump.mockResolvedValue(undefined);
});

describe('TagDumpsPage', () => {
  it('shows the dumps tagged with the tag from the URL', async () => {
    renderPage();

    const cards = await screen.findAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByText('buy coffee #casa')).toBeInTheDocument();
    expect(within(cards[1]!).getByText(/fix the sink/)).toBeInTheDocument();
  });

  it('heads the page with the tag and how many dumps it holds', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { name: '#casa' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 dumps')).toBeInTheDocument();
  });

  it('uses the singular for a single dump', async () => {
    mockedListDumps.mockResolvedValue([dumps[0]!]);
    renderPage();

    expect(await screen.findByText('1 dump')).toBeInTheDocument();
  });

  it('shows the tags and the date of each dump', async () => {
    renderPage();

    const cards = await screen.findAllByRole('listitem');
    expect(within(cards[1]!).getByText('#home')).toBeInTheDocument();
    expect(
      within(cards[1]!).getByText(/Oct \d{1,2}, 2026/),
    ).toBeInTheDocument();
    expect(within(cards[0]!).queryByText('#home')).not.toBeInTheDocument();
  });
});

describe('TagDumpsPage states', () => {
  it('shows a loading state before the dumps arrive', async () => {
    renderPage();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText(/dumps$/)).not.toBeInTheDocument();

    await screen.findAllByRole('listitem');
  });

  it('invites you to dump when the tag has no dumps', async () => {
    mockedListDumps.mockResolvedValue([]);
    renderPage();

    expect(
      await screen.findByText(/no dumps with #casa yet/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dump/i })).toHaveAttribute(
      'href',
      '/',
    );
  });
});

describe('TagDumpsPage errors', () => {
  it('shows the API error when the dumps cannot be loaded', async () => {
    mockedListDumps.mockRejectedValue(new Error('Database is down'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is down',
    );
  });

  it('falls back to a generic message when loading fails without an error', async () => {
    mockedListDumps.mockRejectedValue('boom');
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the dumps',
    );
  });

  it('reads the decoded tag from the URL', async () => {
    renderPage('/tag/caf%C3%A9');

    await screen.findAllByRole('listitem');

    expect(mockedListDumps).toHaveBeenCalledWith('café');
    expect(screen.getByRole('heading', { name: '#café' })).toBeInTheDocument();
  });
});

describe('TagDumpsPage create', () => {
  it('starts the composer with the tag from the URL', async () => {
    renderPage();

    expect(
      await screen.findByRole('textbox', { name: 'New dump' }),
    ).toHaveValue('#casa ');
  });

  it('uses the decoded tag in the composer', async () => {
    renderPage('/tag/caf%C3%A9');

    await findCards();

    expect(screen.getByRole('textbox', { name: 'New dump' })).toHaveValue(
      '#café ',
    );
  });

  it('adds the new dump to the top of the list without refetching', async () => {
    const user = userEvent.setup();
    mockedCreateDump.mockResolvedValue({
      id: 'dump-3',
      content: '#casa water the plants',
      createdAt: '2026-10-15T10:00:00.000Z',
      tags: [{ id: 'tag-1', name: 'casa' }],
    });
    renderPage();
    const textarea = await screen.findByRole('textbox', { name: 'New dump' });

    await user.type(textarea, 'water the plants{Enter}');

    expect(mockedCreateDump).toHaveBeenCalledWith('#casa water the plants');
    const cards = await findCards();
    expect(cards).toHaveLength(3);
    expect(
      within(cards[0]!).getByText('#casa water the plants'),
    ).toBeInTheDocument();
    expect(screen.getByText('3 dumps')).toBeInTheDocument();
    expect(textarea).toHaveValue('#casa ');
    expect(mockedListDumps).toHaveBeenCalledTimes(1);
  });
});

describe('TagDumpsPage create and the tag match', () => {
  it('matches the page tag ignoring case', async () => {
    const user = userEvent.setup();
    mockedCreateDump.mockResolvedValue({
      id: 'dump-3',
      content: '#Casa water the plants',
      createdAt: '2026-10-15T10:00:00.000Z',
      tags: [{ id: 'tag-1', name: 'casa' }],
    });
    renderPage('/tag/Casa');
    const textarea = await screen.findByRole('textbox', { name: 'New dump' });

    await user.type(textarea, 'water the plants{Enter}');

    expect(mockedCreateDump).toHaveBeenCalledWith('#Casa water the plants');
    expect(await findCards()).toHaveLength(3);
  });

  it('adds a dump that carries the page tag along with other tags', async () => {
    const user = userEvent.setup();
    mockedCreateDump.mockResolvedValue({
      id: 'dump-3',
      content: '#outra water the plants #casa',
      createdAt: '2026-10-15T10:00:00.000Z',
      tags: [
        { id: 'tag-9', name: 'outra' },
        { id: 'tag-1', name: 'casa' },
      ],
    });
    renderPage();
    const textarea = await screen.findByRole('textbox', { name: 'New dump' });

    await user.clear(textarea);
    await user.type(textarea, '#outra water the plants #casa{Enter}');

    expect(await findCards()).toHaveLength(3);
    const cards = await findCards();
    expect(
      within(cards[0]!).getByText('#outra water the plants #casa'),
    ).toBeInTheDocument();
  });

  it('leaves the list alone when the saved dump carries another tag', async () => {
    const user = userEvent.setup();
    mockedCreateDump.mockResolvedValue({
      id: 'dump-3',
      content: '#outra water the plants',
      createdAt: '2026-10-15T10:00:00.000Z',
      tags: [{ id: 'tag-9', name: 'outra' }],
    });
    renderPage();
    const textarea = await screen.findByRole('textbox', { name: 'New dump' });

    await user.clear(textarea);
    await user.type(textarea, '#outra water the plants{Enter}');

    await waitFor(() => expect(mockedCreateDump).toHaveBeenCalledTimes(1));
    expect(await findCards()).toHaveLength(2);
    expect(screen.getByText('2 dumps')).toBeInTheDocument();
  });
});

describe('TagDumpsPage create errors', () => {
  it('shows the composer error and keeps the draft when saving fails', async () => {
    const user = userEvent.setup();
    mockedCreateDump.mockRejectedValue(new Error('Database is down'));
    renderPage();
    const textarea = await screen.findByRole('textbox', { name: 'New dump' });

    await user.type(textarea, 'water the plants{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is down',
    );
    expect(textarea).toHaveValue('#casa water the plants');
  });
});

describe('TagDumpsPage edit', () => {
  it('edits a dump inline and keeps the order of the list', async () => {
    const user = userEvent.setup();
    mockedUpdateDump.mockResolvedValue({
      id: 'dump-1',
      content: 'buy tea #casa',
      createdAt: '2026-10-14T12:00:00.000Z',
      tags: [{ id: 'tag-1', name: 'casa' }],
    });
    renderPage();
    const [first] = await findCards();
    const editButton = within(first!).getByRole('button', {
      name: 'Edit dump',
    });
    expect(editButton.querySelector('svg')).not.toBeNull();

    await user.click(editButton);
    const editor = within(first!).getByRole('textbox', { name: 'Edit dump' });
    expect(editor).toHaveValue('buy coffee #casa');

    await user.clear(editor);
    await user.type(editor, 'buy tea #casa');
    await user.click(within(first!).getByRole('button', { name: 'Save' }));

    expect(mockedUpdateDump).toHaveBeenCalledWith('dump-1', 'buy tea #casa');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const cards = await findCards();
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByText('buy tea #casa')).toBeInTheDocument();
    expect(within(cards[1]!).getByText(/fix the sink/)).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Edit dump' }),
    ).not.toBeInTheDocument();
  });

  it('saves with Enter, trimming the content', async () => {
    const user = userEvent.setup();
    mockedUpdateDump.mockResolvedValue({
      id: 'dump-1',
      content: 'buy tea #casa',
      createdAt: '2026-10-14T12:00:00.000Z',
      tags: [{ id: 'tag-1', name: 'casa' }],
    });
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit dump' }));
    const editor = within(first!).getByRole('textbox', { name: 'Edit dump' });
    await user.clear(editor);
    await user.type(editor, 'buy tea #casa {Enter}');

    expect(mockedUpdateDump).toHaveBeenCalledWith('dump-1', 'buy tea #casa');
    expect(await screen.findByText('buy tea #casa')).toBeInTheDocument();
  });
});

describe('TagDumpsPage edit cancelling', () => {
  it('cancels the edit on Escape without calling the API', async () => {
    const user = userEvent.setup();
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit dump' }));
    const editor = within(first!).getByRole('textbox', { name: 'Edit dump' });
    await user.clear(editor);
    await user.type(editor, 'throw this away{Escape}');

    expect(mockedUpdateDump).not.toHaveBeenCalled();
    expect(within(first!).getByText('buy coffee #casa')).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Edit dump' }),
    ).not.toBeInTheDocument();
  });

  it('cancels the edit on the Cancel button', async () => {
    const user = userEvent.setup();
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit dump' }));
    await user.click(within(first!).getByRole('button', { name: 'Cancel' }));

    expect(mockedUpdateDump).not.toHaveBeenCalled();
    expect(within(first!).getByText('buy coffee #casa')).toBeInTheDocument();
  });
});

describe('TagDumpsPage edit and the tag match', () => {
  it('drops the dump from the list when the tag leaves the content', async () => {
    const user = userEvent.setup();
    mockedUpdateDump.mockResolvedValue({
      id: 'dump-1',
      content: 'buy tea #outra',
      createdAt: '2026-10-14T12:00:00.000Z',
      tags: [{ id: 'tag-9', name: 'outra' }],
    });
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit dump' }));
    const editor = within(first!).getByRole('textbox', { name: 'Edit dump' });
    await user.clear(editor);
    await user.type(editor, 'buy tea #outra{Enter}');

    expect(await screen.findByText('1 dump')).toBeInTheDocument();
    expect(screen.queryByText('buy tea #outra')).not.toBeInTheDocument();
    const cards = await findCards();
    expect(cards).toHaveLength(1);
    expect(within(cards[0]!).getByText(/fix the sink/)).toBeInTheDocument();
    expect(screen.queryByText('buy coffee #casa')).not.toBeInTheDocument();
  });
});

describe('TagDumpsPage edit errors', () => {
  it('shows the API error inside the card and keeps the draft', async () => {
    const user = userEvent.setup();
    mockedUpdateDump.mockRejectedValue(new Error('Database is down'));
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit dump' }));
    const editor = within(first!).getByRole('textbox', { name: 'Edit dump' });
    await user.clear(editor);
    await user.type(editor, 'buy tea #casa{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is down',
    );
    expect(
      within(first!).getByRole('textbox', { name: 'Edit dump' }),
    ).toHaveValue('buy tea #casa');
    expect(screen.getByText('2 dumps')).toBeInTheDocument();
  });

  it('falls back to a generic message when the update fails without an error', async () => {
    const user = userEvent.setup();
    mockedUpdateDump.mockRejectedValue('boom');
    renderPage();
    const [first] = await findCards();

    await user.click(within(first!).getByRole('button', { name: 'Edit dump' }));
    await user.click(within(first!).getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not update the dump',
    );
  });
});

describe('TagDumpsPage delete', () => {
  it('asks for confirmation before deleting', async () => {
    const user = userEvent.setup();
    renderPage();
    const [first] = await findCards();

    const deleteButton = within(first!).getByRole('button', {
      name: 'Delete dump',
    });
    expect(deleteButton.querySelector('svg')).not.toBeNull();

    await user.click(deleteButton);

    expect(mockedDeleteDump).not.toHaveBeenCalled();
    expect(
      within(first!).getByRole('button', { name: 'Confirm delete' }),
    ).toBeInTheDocument();
  });

  it('deletes the dump on the second click', async () => {
    const user = userEvent.setup();
    renderPage();
    const [first] = await findCards();

    await user.click(
      within(first!).getByRole('button', { name: 'Delete dump' }),
    );
    await user.click(
      within(first!).getByRole('button', { name: 'Confirm delete' }),
    );

    expect(mockedDeleteDump).toHaveBeenCalledWith('dump-1');
    expect(await screen.findByText('1 dump')).toBeInTheDocument();
    expect(screen.queryByText('buy coffee #casa')).not.toBeInTheDocument();
    expect(mockedListDumps).toHaveBeenCalledTimes(1);
  });

  it('drops the confirmation when the focus moves to another dump', async () => {
    const user = userEvent.setup();
    renderPage();
    const [first, second] = await findCards();

    await user.click(
      within(first!).getByRole('button', { name: 'Delete dump' }),
    );
    await user.click(
      within(second!).getByRole('button', { name: 'Delete dump' }),
    );

    expect(
      within(first!).queryByRole('button', { name: 'Confirm delete' }),
    ).not.toBeInTheDocument();
    expect(
      within(second!).getByRole('button', { name: 'Confirm delete' }),
    ).toBeInTheDocument();
  });
});

describe('TagDumpsPage delete errors', () => {
  it('keeps the dump and shows the API error when the delete fails', async () => {
    const user = userEvent.setup();
    mockedDeleteDump.mockRejectedValue(new Error('Dump not found'));
    renderPage();
    const [first] = await findCards();

    await user.click(
      within(first!).getByRole('button', { name: 'Delete dump' }),
    );
    await user.click(
      within(first!).getByRole('button', { name: 'Confirm delete' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Dump not found',
    );
    expect(within(first!).getByText('buy coffee #casa')).toBeInTheDocument();
    expect(
      within(first!).getByRole('button', { name: 'Delete dump' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 dumps')).toBeInTheDocument();
  });

  it('falls back to a generic message when the delete fails without an error', async () => {
    const user = userEvent.setup();
    mockedDeleteDump.mockRejectedValue('boom');
    renderPage();
    const [first] = await findCards();

    await user.click(
      within(first!).getByRole('button', { name: 'Delete dump' }),
    );
    await user.click(
      within(first!).getByRole('button', { name: 'Confirm delete' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not delete the dump',
    );
  });
});
