/**
 * NOTE: Re-enabled after P0 hardening pass.
 * CI stability should be monitored when running full suites.
 */
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders auth screen when no session', async () => {
  render(<App />);
  expect(
    await screen.findByRole('heading', {
      name: /więcej|więcej niż|worklog|voice/i,
    })
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /wejd|zalog|start|otwórz/i })).toBeInTheDocument();
});
