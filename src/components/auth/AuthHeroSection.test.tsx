import { render, screen } from '@testing-library/react';
import AuthHeroSection from './AuthHeroSection';

describe('AuthHeroSection', () => {
  it('renders hero branding and feature blocks', () => {
    const { container } = render(<AuthHeroSection />);

    expect(container.querySelector('.auth-hero-branding')).toHaveTextContent(/VoiceB/i);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
    expect(screen.getByText(/insight driven analytics/i)).toBeInTheDocument();
  });
});
