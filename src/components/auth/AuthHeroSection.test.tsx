import { render, screen } from '@testing-library/react';
import AuthHeroSection from './AuthHeroSection';

describe('AuthHeroSection', () => {
  it('renders VoiceBóbr branding and feature blocks', () => {
    const { container } = render(<AuthHeroSection />);

    expect(screen.getByRole('img', { name: 'VoiceBóbr' })).toBeInTheDocument();
    expect(container.querySelector('.auth-hero-branding')).toHaveTextContent('VoiceBóbr');
    expect(screen.getByText(/Cześć, jestem VoiceBóbr/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Więcej niż transkrypcja.' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
    expect(screen.getByText(/VoiceBóbr wyciąga decyzje/i)).toBeInTheDocument();
  });
});
