import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/utils';
import { ManualUpiPaymentView } from './ManualUpiPaymentView';
import type { ManualUpiPayment } from '../../lib/types';

describe('ManualUpiPaymentView', () => {
  const genericPayment: ManualUpiPayment = {
    token: 'AMA-A7K42',
    vpa: 'shopowner@upi',
    qrDataUri: 'data:image/png;base64,mockqr',
    upiUri: 'upi://pay?pa=shopowner@upi&pn=Amanly&am=499.00&cu=INR&tr=ORDER123',
    amount: 499,
    currency: 'INR',
    tokenVerificationEnabled: false,
  };

  const verifiedPayment: ManualUpiPayment = {
    token: 'AMA-A7K42',
    vpa: 'shopowner@upi',
    qrDataUri: 'data:image/png;base64,mockqr',
    upiUri: 'upi://pay?pa=shopowner@upi&pn=Amanly&am=499.00&cu=INR&tn=Aman%3A%20AMA-A7K42%20via%20PhonePe&tr=ORDER123',
    amount: 499,
    currency: 'INR',
    app: 'PHONEPE',
    appLabel: 'PhonePe',
    tokenVerificationEnabled: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders amount, payee VPA and two clear payment options (Scan QR and Pay on phone)', () => {
    renderWithProviders(
      <ManualUpiPaymentView
        payment={genericPayment}
        onMarkDone={vi.fn()}
      />
    );

    expect(screen.getByText(/499/)).toBeInTheDocument();
    expect(screen.getByText(/shopowner@upi/)).toBeInTheDocument();

    // Both payment methods are obvious
    expect(screen.getByRole('tab', { name: /pay on this phone/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /scan qr code/i })).toBeInTheDocument();
  });

  it('does NOT display raw upi:// URL text directly to the user', () => {
    const { container } = renderWithProviders(
      <ManualUpiPaymentView
        payment={genericPayment}
        defaultMode="phone"
        onMarkDone={vi.fn()}
      />
    );

    // The raw text upi://pay should never appear in visible text
    expect(container.textContent).not.toContain('upi://pay');
  });

  it('provides direct UPI app launch using the existing payment URI in phone mode', () => {
    renderWithProviders(
      <ManualUpiPaymentView
        payment={genericPayment}
        defaultMode="phone"
        onMarkDone={vi.fn()}
      />
    );

    // Main universal intent button
    const mainPayLink = screen.getByRole('link', { name: /pay via any upi app/i });
    expect(mainPayLink).toBeInTheDocument();
    expect(mainPayLink).toHaveAttribute('href', genericPayment.upiUri);

    // Popular app shortcuts
    const phonePeLink = screen.getByRole('link', { name: /phonepe/i });
    expect(phonePeLink).toBeInTheDocument();
    expect(phonePeLink.getAttribute('href')).toContain('phonepe://pay');

    const gpayLink = screen.getByRole('link', { name: /google pay/i });
    expect(gpayLink).toBeInTheDocument();
    expect(gpayLink.getAttribute('href')).toContain('tez://upi/pay');
  });

  it('switches seamlessly to QR code view when user chooses Scan QR Code', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ManualUpiPaymentView
        payment={genericPayment}
        defaultMode="phone"
        onMarkDone={vi.fn()}
      />
    );

    const qrTab = screen.getByRole('tab', { name: /scan qr code/i });
    await user.click(qrTab);

    expect(screen.getByAltText(/scan to pay via upi/i)).toBeInTheDocument();
    expect(screen.getByText(/scan with any upi app to pay from another device/i)).toBeInTheDocument();
  });

  it('renders dedicated app launcher and payment token when token verification is active', () => {
    renderWithProviders(
      <ManualUpiPaymentView
        payment={verifiedPayment}
        customerName="Aman"
        defaultMode="phone"
        onMarkDone={vi.fn()}
      />
    );

    // Dedicated button for preselected app
    const payAppBtn = screen.getByRole('link', { name: /pay with phonepe/i });
    expect(payAppBtn).toBeInTheDocument();
    expect(payAppBtn.getAttribute('href')).toContain('phonepe://pay');

    // Token displayed
    expect(screen.getByText(/your payment token/i)).toBeInTheDocument();
    expect(screen.getByText(/Aman: AMA-A7K42/)).toBeInTheDocument();
  });

  it('copies UPI ID to clipboard when Copy button is pressed', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    renderWithProviders(
      <ManualUpiPaymentView
        payment={genericPayment}
        onMarkDone={vi.fn()}
      />
    );

    const copyBtn = screen.getByRole('button', { name: /copy upi id/i });
    await user.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith('shopowner@upi');
    expect(screen.getByText(/copied/i)).toBeInTheDocument();
  });

  it('preserves existing payment verification flow: opening UPI app does not mark paid', async () => {
    const onMarkDone = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <ManualUpiPaymentView
        payment={genericPayment}
        defaultMode="phone"
        showMarkDone={true}
        onMarkDone={onMarkDone}
      />
    );

    const mainPayLink = screen.getByRole('link', { name: /pay via any upi app/i });
    expect(mainPayLink).toHaveAttribute('href', genericPayment.upiUri);
    // Opening or clicking intent link does not confirm payment
    expect(onMarkDone).not.toHaveBeenCalled();

    // User explicitly marks payment done
    const markDoneBtn = screen.getByRole('button', { name: /mark payment done/i });
    await user.click(markDoneBtn);
    expect(onMarkDone).toHaveBeenCalledTimes(1);
  });
});
