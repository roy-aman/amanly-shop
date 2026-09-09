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

  const otherPayment: ManualUpiPayment = {
    token: 'AMA-OTH01',
    vpa: 'shopowner@upi',
    qrDataUri: 'data:image/png;base64,mockqr',
    upiUri: 'upi://pay?pa=shopowner@upi&pn=Amanly&am=499.00&cu=INR&tr=ORDER125',
    amount: 499,
    currency: 'INR',
    app: 'OTHER',
    appLabel: 'Other UPI App',
    tokenVerificationEnabled: true,
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
    expect(screen.getAllByText(/shopowner@upi/)[0]).toBeInTheDocument();

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

  it('displays UPI apps selection when user selects just UPI (generic), allowing 1-tap app switching', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ManualUpiPaymentView
        payment={genericPayment}
        defaultMode="phone"
        onMarkDone={vi.fn()}
      />
    );

    // Main button defaults to universal UPI intent
    const mainPayLink = screen.getByRole('link', { name: /pay via any upi app/i });
    expect(mainPayLink).toBeInTheDocument();
    expect(mainPayLink).toHaveAttribute('href', genericPayment.upiUri);

    // Available UI-compatible apps selection is displayed
    expect(screen.getByText(/select your upi app/i)).toBeInTheDocument();
    const gpayRadio = screen.getByRole('radio', { name: /google pay/i });
    const phonePeRadio = screen.getByRole('radio', { name: /phonepe/i });
    const paytmRadio = screen.getByRole('radio', { name: /paytm/i });

    expect(gpayRadio).toBeInTheDocument();
    expect(phonePeRadio).toBeInTheDocument();
    expect(paytmRadio).toBeInTheDocument();

    // Select PhonePe from available apps
    await user.click(phonePeRadio);

    // Main button dynamically switches to PhonePe deep link
    const updatedPayLink = screen.getByRole('link', { name: /pay with phonepe/i });
    expect(updatedPayLink).toBeInTheDocument();
    expect(updatedPayLink.getAttribute('href')).toContain('phonepe://pay');

    // Select Google Pay
    await user.click(gpayRadio);
    const gpayPayLink = screen.getByRole('link', { name: /pay with google pay/i });
    expect(gpayPayLink).toBeInTheDocument();
    expect(gpayPayLink.getAttribute('href')).toContain('tez://upi/pay');
  });

  it('displays UPI apps selection when user selects OTHER payment app under token verification', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ManualUpiPaymentView
        payment={otherPayment}
        customerName="Aman"
        defaultMode="phone"
        onMarkDone={vi.fn()}
      />
    );

    // Apps selector is visible
    expect(screen.getByText(/select your upi app/i)).toBeInTheDocument();
    const paytmRadio = screen.getByRole('radio', { name: /paytm/i });
    await user.click(paytmRadio);

    const paytmLink = screen.getByRole('link', { name: /pay with paytm/i });
    expect(paytmLink).toBeInTheDocument();
    expect(paytmLink.getAttribute('href')).toContain('paytmmp://pay');
  });

  it('renders app-specific button and icon when a UPI app is preselected (e.g. Google Pay)', async () => {
    const user = userEvent.setup();
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
    expect(payLink.getAttribute('href')).toContain('tez://upi/pay');

    // Token displayed
    expect(screen.getByText(/your payment token • google pay/i)).toBeInTheDocument();
    expect(screen.getByText(/Aman Raj: AMA-49BV8/)).toBeInTheDocument();

    // App selector is directly available on the pay option
    expect(screen.getByText(/select your upi app/i)).toBeInTheDocument();
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

    const payLink = screen.getByRole('link', { name: /pay via any upi app/i });
    expect(payLink).toHaveAttribute('href', genericPayment.upiUri);
    expect(onMarkDone).not.toHaveBeenCalled();

    const markDoneBtn = screen.getByRole('button', { name: /mark payment done/i });
    await user.click(markDoneBtn);
    expect(onMarkDone).toHaveBeenCalledTimes(1);
  });
  it('switches QR code, VPA, and deep link dynamically when admin defines appTargets', async () => {
    const user = userEvent.setup();
    const targetedPayment: ManualUpiPayment = {
      token: 'AMA-A7K42',
      vpa: 'common@upi',
      qrDataUri: 'data:image/png;base64,common_qr',
      upiUri: 'upi://pay?pa=common@upi&pn=Store&am=499.00&cu=INR&tr=ORDER123',
      amount: 499,
      currency: 'INR',
      tokenVerificationEnabled: true,
      appTargets: [
        {
          app: null,
          appLabel: 'Any UPI App',
          vpa: 'common@upi',
          upiUri: 'upi://pay?pa=common@upi&pn=Store&am=499.00&cu=INR&tr=ORDER123',
          qrDataUri: 'data:image/png;base64,common_qr',
        },
        {
          app: 'PHONEPE',
          appLabel: 'PhonePe',
          vpa: 'admin-phonepe@ybl',
          upiUri: 'upi://pay?pa=admin-phonepe@ybl&pn=Store&am=499.00&cu=INR&tr=ORDER123',
          qrDataUri: 'data:image/png;base64,phonepe_qr',
        },
        {
          app: 'GOOGLE_PAY',
          appLabel: 'Google Pay',
          vpa: 'admin-gpay@okaxis',
          upiUri: 'upi://pay?pa=admin-gpay@okaxis&pn=Store&am=499.00&cu=INR&tr=ORDER123',
          qrDataUri: 'data:image/png;base64,gpay_qr',
        },
      ],
    };

    renderWithProviders(
      <ManualUpiPaymentView
        payment={targetedPayment}
        defaultMode="qr"
        onMarkDone={vi.fn()}
      />
    );

    // Initial QR image is common_qr
    const qrImg = screen.getByAltText(/scan to pay via upi/i);
    expect(qrImg).toHaveAttribute('src', 'data:image/png;base64,common_qr');
    expect(screen.getAllByText(/common@upi/)[0]).toBeInTheDocument();

    // Select PhonePe on QR tab
    const phonePeRadio = screen.getByRole('radio', { name: /phonepe/i });
    await user.click(phonePeRadio);

    // QR image immediately switches to PhonePe's admin-defined QR
    expect(qrImg).toHaveAttribute('src', 'data:image/png;base64,phonepe_qr');
    expect(screen.getAllByText(/admin-phonepe@ybl/)[0]).toBeInTheDocument();

    // Select CRED (unconfigured by admin) -> falls back to common fallback VPA & QR
    const credRadio = screen.getByRole('radio', { name: /cred/i });
    await user.click(credRadio);
    expect(qrImg).toHaveAttribute('src', 'data:image/png;base64,common_qr');
    expect(screen.getAllByText(/common@upi/)[0]).toBeInTheDocument();
  });
});
