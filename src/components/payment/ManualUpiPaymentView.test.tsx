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

  const googlePayPayment: ManualUpiPayment = {
    token: 'AMA-49BV8',
    vpa: 'royaman78@axl',
    qrDataUri: 'data:image/png;base64,mockqr',
    upiUri: 'upi://pay?pa=royaman78@axl&pn=Amanly&am=1.00&cu=INR&tn=Aman%20Raj%3A%20AMA-49BV8%20via%20Google%20Pay&tr=ORDER124',
    amount: 1,
    currency: 'INR',
    app: 'GOOGLE_PAY',
    appLabel: 'Google Pay',
    tokenVerificationEnabled: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders amount, payee VPA and both payment options (Pay on phone and Scan QR)', () => {
    renderWithProviders(
      <ManualUpiPaymentView
        payment={genericPayment}
        onMarkDone={vi.fn()}
      />
    );

    expect(screen.getByText(/499/)).toBeInTheDocument();
    expect(screen.getByText(/shopowner@upi/)).toBeInTheDocument();

    // Segmented tabs
    expect(screen.getByRole('tab', { name: /pay on this phone/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /scan qr code/i })).toBeInTheDocument();
  });

  it('does NOT display raw upi:// URL text directly in visible copy', () => {
    const { container } = renderWithProviders(
      <ManualUpiPaymentView
        payment={genericPayment}
        defaultMode="phone"
        onMarkDone={vi.fn()}
      />
    );

    expect(container.textContent).not.toContain('upi://pay');
  });

  it('renders generic Pay via UPI button when no app is preselected', () => {
    renderWithProviders(
      <ManualUpiPaymentView
        payment={genericPayment}
        defaultMode="phone"
        onMarkDone={vi.fn()}
      />
    );

    // Primary generic UPI button (UPI logo only, no cluttered extra app buttons)
    const payLink = screen.getByRole('link', { name: /pay via upi/i });
    expect(payLink).toBeInTheDocument();
    expect(payLink).toHaveAttribute('href', genericPayment.upiUri);
  });

  it('renders app-specific button and icon when a UPI app is selected (e.g. Google Pay)', () => {
    renderWithProviders(
      <ManualUpiPaymentView
        payment={googlePayPayment}
        customerName="Aman Raj"
        defaultMode="phone"
        onMarkDone={vi.fn()}
      />
    );

    // Shows "Pay with Google Pay"
    const payLink = screen.getByRole('link', { name: /pay with google pay/i });
    expect(payLink).toBeInTheDocument();
    // Google Pay deep link tez://upi/pay
    expect(payLink.getAttribute('href')).toContain('tez://upi/pay');

    // Token displayed
    expect(screen.getByText(/your payment token • google pay/i)).toBeInTheDocument();
    expect(screen.getByText(/Aman Raj: AMA-49BV8/)).toBeInTheDocument();
  });

  it('renders app-specific button and deep link for PhonePe', () => {
    renderWithProviders(
      <ManualUpiPaymentView
        payment={verifiedPayment}
        customerName="Aman"
        defaultMode="phone"
        onMarkDone={vi.fn()}
      />
    );

    const payLink = screen.getByRole('link', { name: /pay with phonepe/i });
    expect(payLink).toBeInTheDocument();
    expect(payLink.getAttribute('href')).toContain('phonepe://pay');
    expect(screen.getByText(/Aman: AMA-A7K42/)).toBeInTheDocument();
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
    expect(screen.getByText(/scan with any upi app/i)).toBeInTheDocument();
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

    const payLink = screen.getByRole('link', { name: /pay via upi/i });
    expect(payLink).toHaveAttribute('href', genericPayment.upiUri);
    expect(onMarkDone).not.toHaveBeenCalled();

    const markDoneBtn = screen.getByRole('button', { name: /mark payment done/i });
    await user.click(markDoneBtn);
    expect(onMarkDone).toHaveBeenCalledTimes(1);
  });
});
