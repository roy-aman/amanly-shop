import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { AiImageStudio } from './AiImageStudio';
import { aiImages } from '@/api/ai';
import { ApiError } from '@/lib/http';

vi.mock('@/api/ai', () => ({
  aiImages: { quota: vi.fn(), views: vi.fn(), draftPrompts: vi.fn(), generateImage: vi.fn() },
}));

const quotaMock = vi.mocked(aiImages.quota);
const draftMock = vi.mocked(aiImages.draftPrompts);
const generateMock = vi.mocked(aiImages.generateImage);

const onUse = vi.fn();
const onClose = vi.fn();

function render(props: Partial<Parameters<typeof AiImageStudio>[0]> = {}) {
  return renderWithProviders(
    <AiImageStudio
      open
      onClose={onClose}
      context={{ productName: 'Air Zoom', categoryName: 'Running Shoes', brandName: 'Nike' }}
      onUse={onUse}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  quotaMock.mockResolvedValue({
    allowed: true,
    used: 2,
    limit: 20,
    maxViewsPerRequest: 6,
    approxSecondsPerImage: 10,
    remaining: 18,
  });
  draftMock.mockResolvedValue([
    { view: 'FRONT', prompt: 'A single Nike Air Zoom, a running shoes. Front view…' },
  ]);
  generateMock.mockResolvedValue({
    view: 'FRONT',
    prompt: 'A single Nike Air Zoom, a running shoes. Front view…',
    url: 'https://cdn.example.com/front.jpg',
    allUrls: ['https://cdn.example.com/front.jpg'],
  });
});

describe('AI image studio', () => {
  it('offers all six sides', async () => {
    render();
    for (const side of ['Front', 'Back', 'Left', 'Right', 'Top', 'Bottom']) {
      expect(await screen.findByRole('button', { name: side })).toBeInTheDocument();
    }
  });

  /** The catalogue writes the first draft — that is the whole point of the feature. */
  it('drafts a prompt from the product context', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: /draft prompts/i }));

    await waitFor(() => expect(draftMock).toHaveBeenCalled());
    expect(draftMock.mock.calls[0][0]).toMatchObject({
      productName: 'Air Zoom',
      categoryName: 'Running Shoes',
      brandName: 'Nike',
      views: ['FRONT'],
    });
    expect(await screen.findByDisplayValue(/Nike Air Zoom/)).toBeInTheDocument();
  });

  /**
   * The defining behaviour: nothing is generated until the merchant has had the
   * chance to read and change the words. Drafting alone must not spend anything.
   */
  it('generates nothing until the merchant asks', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: /draft prompts/i }));
    await screen.findByDisplayValue(/Nike Air Zoom/);

    expect(generateMock).not.toHaveBeenCalled();
  });

  it('sends the edited prompt, not the drafted one', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: /draft prompts/i }));
    const box = await screen.findByDisplayValue(/Nike Air Zoom/);

    await user.clear(box);
    await user.type(box, 'A red running shoe on marble');
    await user.click(screen.getByRole('button', { name: /^generate image$/i }));

    await waitFor(() => expect(generateMock).toHaveBeenCalled());
    expect(generateMock.mock.calls[0][0].prompt).toBe('A red running shoe on marble');
  });

  it('hands the chosen image back to the form', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: /draft prompts/i }));
    await screen.findByDisplayValue(/Nike Air Zoom/);
    await user.click(screen.getByRole('button', { name: /^generate image$/i }));

    await user.click(await screen.findByRole('button', { name: /use this/i }));

    expect(onUse).toHaveBeenCalledWith('https://cdn.example.com/front.jpg', 'FRONT');
  });

  /** One slow side failing must not lose the others, so each is reported alone. */
  it('reports a failed side without discarding the rest', async () => {
    draftMock.mockResolvedValue([
      { view: 'FRONT', prompt: 'front prompt' },
      { view: 'BACK', prompt: 'back prompt' },
    ]);
    generateMock
      .mockRejectedValueOnce(new ApiError(502, 'AI_IMAGE_GENERATION_FAILED', 'Could not generate'))
      .mockResolvedValueOnce({
        view: 'BACK',
        prompt: 'back prompt',
        url: 'https://cdn.example.com/back.jpg',
        allUrls: ['https://cdn.example.com/back.jpg'],
      });

    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: /draft prompts/i }));
    await screen.findByDisplayValue('front prompt');
    await user.click(screen.getByRole('button', { name: /generate 2 images/i }));

    expect(await screen.findByText('Could not generate')).toBeInTheDocument();
    expect(await screen.findByText('Failed')).toBeInTheDocument();
    // The other side still came through and is still usable.
    expect(await screen.findByRole('button', { name: /use this/i })).toBeInTheDocument();
  });

  // ── the platform's gate ──────────────────────────────────────────────

  it('explains itself and offers nothing when the store is not entitled', async () => {
    quotaMock.mockResolvedValue({
      allowed: false,
      used: 0,
      limit: null,
      maxViewsPerRequest: 6,
      approxSecondsPerImage: 10,
      remaining: null,
    });

    render();

    expect(await screen.findByText(/not enabled for this store/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /draft prompts/i })).not.toBeInTheDocument();
  });

  /** Six views really is about a minute; saying so beats a silent spinner. */
  it('warns how long the chosen number of images will take', async () => {
    const user = userEvent.setup();
    render();

    await user.click(await screen.findByRole('button', { name: 'Back' }));

    expect(await screen.findByText(/About 20s for 2 images/i)).toBeInTheDocument();
  });

  it('shows how many generations are left', async () => {
    render();
    expect(await screen.findByText(/18 generations left/i)).toBeInTheDocument();
  });

  // ── categories ───────────────────────────────────────────────────────

  /** A six-sided turntable of an abstract grouping means nothing. */
  it('hides the sides for a category and asks for one image', async () => {
    draftMock.mockResolvedValue([{ view: null, prompt: 'An attractive arrangement of ethnic wear…' }]);
    const user = userEvent.setup();
    render({ singleImage: true, context: { categoryName: 'Ethnic Wear', forCategory: true } });

    expect(screen.queryByRole('button', { name: 'Bottom' })).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /draft prompts/i }));

    await waitFor(() => expect(draftMock).toHaveBeenCalled());
    expect(draftMock.mock.calls[0][0].forCategory).toBe(true);
  });
});
