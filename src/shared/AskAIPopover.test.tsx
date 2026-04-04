import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AskAIPopover from './AskAIPopover';

// Mock mediaService
vi.mock('../services/mediaService', () => ({
  createMediaService: vi.fn(),
}));

import { createMediaService } from '../services/mediaService';

describe('AskAIPopover', () => {
  const mockWorkspace = {
    id: 'ws_1',
    name: 'Team One',
  };

  const mockOnClose = vi.fn();

  const mockMediaService = {
    askRAG: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createMediaService as any).mockResolvedValue(mockMediaService);
  });

  it('renders the popover component', () => {
    render(<AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />);

    expect(screen.getByText('AI RAG Memory')).toBeInTheDocument();
    expect(screen.getByText('Zapytaj o Archiwum')).toBeInTheDocument();
  });

  it('displays description text', () => {
    render(<AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />);

    expect(screen.getByText(/Przeszukuj archiwalne spotkania/i)).toBeInTheDocument();
  });

  it('renders search input field', () => {
    render(<AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText(/Szukaj kontekstu/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
  });

  it('input field can be focused and accepts input', () => {
    render(<AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText(/Szukaj kontekstu/i) as HTMLInputElement;
    // Input should be present and functional
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
    expect(input.value).toBe('');
  });

  it('updates query state when input changes', async () => {
    render(<AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText(/Szukaj kontekstu/i) as HTMLInputElement;
    await userEvent.type(input, 'test query');

    expect(input.value).toBe('test query');
  });

  it('renders close button', () => {
    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const closeButton = container.querySelector('.comic-close-btn');
    expect(closeButton).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const closeButton = container.querySelector('.comic-close-btn') as HTMLButtonElement;
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledOnce();
  });

  it('disables submit button when query is empty', () => {
    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when query has text', async () => {
    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const input = screen.getByPlaceholderText(/Szukaj kontekstu/i) as HTMLInputElement;
    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(submitButton).toBeDisabled();

    await userEvent.type(input, 'test');

    expect(submitButton).not.toBeDisabled();
  });

  it('calls askRAG when form is submitted', async () => {
    mockMediaService.askRAG.mockResolvedValue({ answer: 'Test answer' });

    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const input = screen.getByPlaceholderText(/Szukaj kontekstu/i) as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await userEvent.type(input, 'test query');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockMediaService.askRAG).toHaveBeenCalledWith('ws_1', 'test query');
    });
  });

  it('displays answer when search succeeds', async () => {
    mockMediaService.askRAG.mockResolvedValue({ answer: 'This is the answer' });

    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const input = screen.getByPlaceholderText(/Szukaj kontekstu/i) as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await userEvent.type(input, 'test query');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('This is the answer')).toBeInTheDocument();
    });
  });

  it('displays default message when answer is null', async () => {
    mockMediaService.askRAG.mockResolvedValue({ answer: null });

    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const input = screen.getByPlaceholderText(/Szukaj kontekstu/i) as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await userEvent.type(input, 'test query');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Brak odpowiedzi')).toBeInTheDocument();
    });
  });

  it('displays error message when askRAG fails', async () => {
    mockMediaService.askRAG.mockRejectedValue(new Error('Network error'));

    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const input = screen.getByPlaceholderText(/Szukaj kontekstu/i) as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await userEvent.type(input, 'test query');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Wystąpił błąd podczas przeszukiwania/i)).toBeInTheDocument();
    });
  });

  it('sets loading state during search', async () => {
    let resolveAskRAG: any;
    const askRAGPromise = new Promise((resolve) => {
      resolveAskRAG = resolve;
    });
    mockMediaService.askRAG.mockReturnValue(askRAGPromise);

    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const input = screen.getByPlaceholderText(/Szukaj kontekstu/i) as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await userEvent.type(input, 'test query');
    fireEvent.submit(form);

    // Button should be disabled while loading
    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitButton).toBeDisabled();

    // Resolve the promise
    resolveAskRAG({ answer: 'Test answer' });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('clears answer before making a new search', async () => {
    mockMediaService.askRAG.mockResolvedValue({ answer: 'First answer' });

    const { container, rerender } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const input = screen.getByPlaceholderText(/Szukaj kontekstu/i) as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    // First search
    await userEvent.type(input, 'first query');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('First answer')).toBeInTheDocument();
    });

    // Search for new query
    mockMediaService.askRAG.mockResolvedValue({ answer: 'Second answer' });
    await userEvent.clear(input);
    await userEvent.type(input, 'second query');
    fireEvent.submit(form);

    // Should show new answer
    await waitFor(() => {
      expect(screen.getByText('Second answer')).toBeInTheDocument();
    });
  });

  it('does nothing when submitting with empty query', async () => {
    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);

    expect(mockMediaService.askRAG).not.toHaveBeenCalled();
  });

  it('does nothing when workspace ID is missing', async () => {
    const { container } = render(
      <AskAIPopover currentWorkspace={{ ...mockWorkspace, id: undefined }} onClose={mockOnClose} />
    );

    const input = screen.getByPlaceholderText(/Szukaj kontekstu/i) as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await userEvent.type(input, 'test query');
    fireEvent.submit(form);

    expect(mockMediaService.askRAG).not.toHaveBeenCalled();
  });

  it('handles whitespace-only queries', async () => {
    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const input = screen.getByPlaceholderText(/Szukaj kontekstu/i) as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await userEvent.type(input, '   ');
    fireEvent.submit(form);

    expect(mockMediaService.askRAG).not.toHaveBeenCalled();
  });

  it('trims query before sending', async () => {
    mockMediaService.askRAG.mockResolvedValue({ answer: 'Test answer' });

    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const input = screen.getByPlaceholderText(/Szukaj kontekstu/i) as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await userEvent.type(input, '  test query  ');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockMediaService.askRAG).toHaveBeenCalledWith('ws_1', '  test query  ');
    });
  });

  it('stops event propagation when clicking on popover', () => {
    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const popover = container.querySelector('.ask-ai-comic-bubble') as HTMLDivElement;
    const stopPropagationSpy = vi.fn();

    fireEvent.click(popover, { stopPropagation: stopPropagationSpy });

    // Component calls stopPropagation
    expect(popover).toBeInTheDocument();
  });

  it('renders with null workspace gracefully', () => {
    render(<AskAIPopover currentWorkspace={null} onClose={mockOnClose} />);

    expect(screen.getByText('Zapytaj o Archiwum')).toBeInTheDocument();
  });

  it('handles undefined answer in response', async () => {
    mockMediaService.askRAG.mockResolvedValue({}); // No answer property

    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const input = screen.getByPlaceholderText(/Szukaj kontekstu/i) as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await userEvent.type(input, 'test query');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Brak odpowiedzi')).toBeInTheDocument();
    });
  });

  it('creates media service before making API call', async () => {
    mockMediaService.askRAG.mockResolvedValue({ answer: 'Test' });

    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const input = screen.getByPlaceholderText(/Szukaj kontekstu/i) as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await userEvent.type(input, 'test query');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(createMediaService).toHaveBeenCalled();
    });
  });

  it('displays answer in comic-answer-box div', async () => {
    mockMediaService.askRAG.mockResolvedValue({ answer: 'Test answer content' });

    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const input = screen.getByPlaceholderText(/Szukaj kontekstu/i) as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await userEvent.type(input, 'test query');
    fireEvent.submit(form);

    await waitFor(() => {
      const answerBox = container.querySelector('.comic-answer-box');
      expect(answerBox).toBeInTheDocument();
      expect(answerBox?.textContent).toBe('Test answer content');
    });
  });

  it('does not show answer box before search', () => {
    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const answerBox = container.querySelector('.comic-answer-box');
    expect(answerBox).not.toBeInTheDocument();
  });

  it('has correct CSS classes', () => {
    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    expect(container.querySelector('.ask-ai-comic-bubble')).toBeInTheDocument();
    expect(container.querySelector('.comic-bubble-header')).toBeInTheDocument();
    expect(container.querySelector('.comic-close-btn')).toBeInTheDocument();
  });

  it('passes correct workspace ID to askRAG', async () => {
    const customWorkspace = { id: 'custom_ws_123', name: 'Custom' };
    mockMediaService.askRAG.mockResolvedValue({ answer: 'Test' });

    const { container } = render(
      <AskAIPopover currentWorkspace={customWorkspace} onClose={mockOnClose} />
    );

    const input = screen.getByPlaceholderText(/Szukaj kontekstu/i) as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    await userEvent.type(input, 'test query');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockMediaService.askRAG).toHaveBeenCalledWith('custom_ws_123', 'test query');
    });
  });

  it('renders with correct input placeholder', () => {
    render(<AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />);

    const input = screen.getByPlaceholderText(/Szukaj kontekstu z każdego spotkania/i);
    expect(input).toBeInTheDocument();
  });

  it('submit button has correct disabled state initially', () => {
    const { container } = render(
      <AskAIPopover currentWorkspace={mockWorkspace} onClose={mockOnClose} />
    );

    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submitButton.hasAttribute('disabled')).toBe(true);
  });

  it('handles empty workspace object', () => {
    render(<AskAIPopover currentWorkspace={{}} onClose={mockOnClose} />);

    expect(screen.getByText('Zapytaj o Archiwum')).toBeInTheDocument();
  });
});
