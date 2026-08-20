import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ServiceGalleryEditor } from './ServiceGalleryEditor';
import type { ServiceImageRequest } from '@/lib/types';

vi.mock('@/components/admin/ImageUploadField', () => ({
  // The real control talks to an upload service; here it only needs to hand back a URL.
  ImageUploadField: ({ label, onChange }: { label: string; onChange: (url: string) => void }) => (
    <button type="button" onClick={() => onChange('https://cdn.example.com/new.jpg')}>
      {label}
    </button>
  ),
}));

function images(): ServiceImageRequest[] {
  return [
    { url: 'https://cdn.example.com/a.jpg', altText: 'The room' },
    { url: 'https://cdn.example.com/b.jpg', altText: 'The chair' },
  ];
}

describe('ServiceGalleryEditor', () => {
  it('says which picture is the one that stands for the service', () => {
    // "First" is not obviously meaningful until something says so, and there is
    // no separate primary flag to set.
    render(
      <ServiceGalleryEditor value={images()} onChange={vi.fn()} serviceName="Facial" />,
    );

    expect(screen.getByText(/thumbnail — shown wherever one picture fits/i)).toBeInTheDocument();
  });

  it('reorders by swapping, so moving one picture forward moves the other back', async () => {
    const onChange = vi.fn();
    render(<ServiceGalleryEditor value={images()} onChange={onChange} serviceName="Facial" />);

    await userEvent.click(screen.getByRole('button', { name: 'Move picture 2 earlier' }));

    expect(onChange).toHaveBeenCalledWith([
      { url: 'https://cdn.example.com/b.jpg', altText: 'The chair' },
      { url: 'https://cdn.example.com/a.jpg', altText: 'The room' },
    ]);
  });

  it('cannot move the first picture earlier or the last later', () => {
    render(<ServiceGalleryEditor value={images()} onChange={vi.fn()} serviceName="Facial" />);

    expect(screen.getByRole('button', { name: 'Move picture 1 earlier' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move picture 2 later' })).toBeDisabled();
  });

  it('adds to the end so an existing thumbnail is not displaced by accident', async () => {
    const onChange = vi.fn();
    render(<ServiceGalleryEditor value={images()} onChange={onChange} serviceName="Facial" />);

    await userEvent.click(screen.getByRole('button', { name: 'Add another' }));

    expect(onChange.mock.calls[0][0]).toHaveLength(3);
    expect(onChange.mock.calls[0][0][2].url).toBe('https://cdn.example.com/new.jpg');
  });

  it('removes the picture that was asked for, not the one beside it', async () => {
    const onChange = vi.fn();
    render(<ServiceGalleryEditor value={images()} onChange={onChange} serviceName="Facial" />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove picture 1' }));

    expect(onChange).toHaveBeenCalledWith([{ url: 'https://cdn.example.com/b.jpg', altText: 'The chair' }]);
  });

  it('invites a first picture rather than showing an empty box', () => {
    render(<ServiceGalleryEditor value={[]} onChange={vi.fn()} serviceName="Facial" />);

    expect(screen.getByText(/the first one you add becomes the thumbnail/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a picture' })).toBeInTheDocument();
  });
});
