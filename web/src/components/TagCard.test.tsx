import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { TagCard } from './TagCard';

function renderCard(name: string) {
  return render(
    <MemoryRouter>
      <ul>
        <TagCard tag={{ id: 'tag-1', name, count: 3 }} onDelete={vi.fn()} />
      </ul>
    </MemoryRouter>,
  );
}

describe('TagCard', () => {
  it('links the tag to its page', () => {
    renderCard('casa');

    expect(screen.getByRole('link', { name: /#casa/ })).toHaveAttribute(
      'href',
      '/tag/casa',
    );
  });

  it('encodes the tag into the link', () => {
    renderCard('café');

    expect(screen.getByRole('link', { name: /#café/ })).toHaveAttribute(
      'href',
      '/tag/caf%C3%A9',
    );
  });
});
