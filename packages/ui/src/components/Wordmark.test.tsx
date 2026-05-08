import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Wordmark } from './Wordmark';

describe('Wordmark', () => {
  it('renders a vector ATV Design lockup without legacy Open CoDesign copy', () => {
    const { container } = render(<Wordmark badge="v0.1.4" />);

    expect(screen.getByRole('img', { name: 'ATV Design' })).toBeDefined();
    expect(screen.getByText('ATV')).toBeDefined();
    expect(screen.getByText('Design')).toBeDefined();
    expect(screen.getByText('v0.1.4')).toBeDefined();
    expect(screen.queryByText(/Open CoDesign/i)).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('supports the stacked hero layout for the empty-state brand lockup', () => {
    render(<Wordmark layout="stacked" size="lg" />);

    const logo = screen.getByRole('img', { name: 'ATV Design' }) as HTMLElement;
    expect(logo.style.flexDirection).toBe('column');
  });
});
