import { render, screen } from '@testing-library/react';
import App from './App';

test('renders auth screen when no session', () => {
  render(<App />);
  expect(screen.getByText(/transkrypcja/i)).toBeInTheDocument();
});
