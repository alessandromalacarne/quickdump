import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('main', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.resetModules();
  });

  it('mounts the app into #root and focuses the composer', async () => {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.append(root);

    await import('./main');

    expect(await screen.findByRole('textbox', { name: /dump/i })).toHaveFocus();
  });
});
