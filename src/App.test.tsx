import { render, screen } from '@testing-library/react';
import App from './App';

test('renders auth screen when no session', async () => {
  render(<App />);
  expect(await screen.findByRole('heading', { name: /więcej niż bóbr/i })).toBeInTheDocument();
  expect(screen.getByText(/pracuj szybciej i inteligentniej/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /wejdz do aplikacji/i })).toBeInTheDocument();
});
