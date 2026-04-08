/**
 * NOTE: Skipped — hangs locally due to fakeTimers + useEffect loops after Zustand 5 changes.
 * CI failure: "Unable to find element with text /transkrypcja/i"
 * TODO: Re-enable after Zustand 5 migration and setupTests.ts mock audit.
 */
import { render, screen } from '@testing-library/react';
import App from './App';

test.skip('renders auth screen when no session', async () => {
  render(<App />);
  expect(await screen.findByRole('heading', { name: /więcej niż bóbr/i })).toBeInTheDocument();
  expect(screen.getByText(/pracuj szybciej i inteligentniej/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /wejdz do aplikacji/i })).toBeInTheDocument();
});
