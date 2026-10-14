import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteTag, listTags } from '../api';
import { TagsPage } from './TagsPage';

vi.mock('../api', () => ({
  listTags: vi.fn(),
  deleteTag: vi.fn(),
}));

const mockedListTags = vi.mocked(listTags);
const mockedDeleteTag = vi.mocked(deleteTag);

const tags = [
  { id: 'tag-1', name: 'casa', count: 3 },
  { id: 'tag-2', name: 'trabalho', count: 1 },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <TagsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedListTags.mockResolvedValue(tags);
  mockedDeleteTag.mockResolvedValue(undefined);
});

describe('TagsPage', () => {
  it('lists every tag with its dump count', async () => {
    renderPage();

    const casa = await screen.findByRole('listitem', { name: /casa/ });
    expect(within(casa).getByText('#casa')).toBeInTheDocument();
    expect(within(casa).getByText('3 dumps')).toBeInTheDocument();

    const trabalho = screen.getByRole('listitem', { name: /trabalho/ });
    expect(within(trabalho).getByText('#trabalho')).toBeInTheDocument();
    expect(within(trabalho).getByText('1 dump')).toBeInTheDocument();
  });

  it('shows a loading state before the tags arrive', async () => {
    renderPage();

    expect(screen.getByRole('status')).toBeInTheDocument();

    await screen.findByRole('listitem', { name: /casa/ });
  });

  it('invites you to dump when there are no tags', async () => {
    mockedListTags.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/no tags yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dump/i })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('shows the API error when the tags cannot be loaded', async () => {
    mockedListTags.mockRejectedValue(new Error('Database is down'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Database is down',
    );
  });

  it('deletes a tag and drops it from the grid', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('listitem', { name: /casa/ });

    const deleteButton = screen.getByRole('button', {
      name: 'Delete tag #casa',
    });
    expect(deleteButton.querySelector('svg')).not.toBeNull();

    await user.click(deleteButton);

    expect(mockedDeleteTag).toHaveBeenCalledWith('tag-1');
    expect(
      await screen.findByRole('listitem', { name: /trabalho/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText('#casa')).not.toBeInTheDocument();
    expect(mockedListTags).toHaveBeenCalledTimes(1);
  });

  it('keeps the tag and shows the error when deleting fails', async () => {
    const user = userEvent.setup();
    mockedDeleteTag.mockRejectedValue(new Error('Tag not found'));
    renderPage();
    await screen.findByRole('listitem', { name: /casa/ });

    await user.click(screen.getByRole('button', { name: 'Delete tag #casa' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Tag not found');
    expect(screen.getByText('#casa')).toBeInTheDocument();
  });

  it('falls back to a generic message when loading fails without an error', async () => {
    mockedListTags.mockRejectedValue('boom');
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the tags',
    );
  });

  it('falls back to a generic message when deleting fails without an error', async () => {
    const user = userEvent.setup();
    mockedDeleteTag.mockRejectedValue('boom');
    renderPage();
    await screen.findByRole('listitem', { name: /casa/ });

    await user.click(screen.getByRole('button', { name: 'Delete tag #casa' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not delete the tag',
    );
  });
});
