import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listDumps } from '../api';
import { TagDumpsPage } from './TagDumpsPage';

vi.mock('../api', () => ({
  listDumps: vi.fn(),
}));

const mockedListDumps = vi.mocked(listDumps);

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

beforeEach(() => {
  vi.clearAllMocks();
  mockedListDumps.mockResolvedValue(dumps);
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
