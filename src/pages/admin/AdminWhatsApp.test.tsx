import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import AdminWhatsApp from './AdminWhatsApp';
import { adminStore, adminWhatsApp } from '@/api/admin';
import type {
  StoreSettingsResponse,
  WhatsAppConnectionResponse,
  WhatsAppFlowTemplateResponse,
  WhatsAppOperatorResponse,
} from '@/lib/types';

// Mock Toast
const toast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

vi.mock('@/context/ToastContext', () => ({
  useToast: () => toast,
}));

// Mock Admin APIs
vi.mock('@/api/admin', () => ({
  adminWhatsApp: {
    getStatus: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    getOperators: vi.fn(),
    registerOperator: vi.fn(),
    getFlows: vi.fn(),
    deployFlow: vi.fn(),
  },
  adminStore: {
    get: vi.fn(),
  },
}));

const mockGetStatus = vi.mocked(adminWhatsApp.getStatus);
const mockConnect = vi.mocked(adminWhatsApp.connect);
const mockDisconnect = vi.mocked(adminWhatsApp.disconnect);
const mockGetOperators = vi.mocked(adminWhatsApp.getOperators);
const mockRegisterOperator = vi.mocked(adminWhatsApp.registerOperator);
const mockGetFlows = vi.mocked(adminWhatsApp.getFlows);
const mockDeployFlow = vi.mocked(adminWhatsApp.deployFlow);
const mockGetStore = vi.mocked(adminStore.get);

const sampleConnected: WhatsAppConnectionResponse = {
  id: 'conn-1',
  storeId: 'store-1',
  phoneNumberId: '104928172648192',
  wabaId: '918273645129384',
  displayPhoneNumber: '+91 98350 12345',
  verifiedName: 'Amanly Sweets',
  qualityRating: 'GREEN',
  status: 'CONNECTED',
  onboardingMethod: 'MANUAL_SYSTEM_USER',
  connected: true,
};

const sampleOperators: WhatsAppOperatorResponse[] = [
  {
    id: 'op-1',
    storeId: 'store-1',
    phoneNumber: '919835012345',
    userId: 'user-1',
    displayName: 'Aman Raj',
    operatorRole: 'STORE_OWNER',
    active: true,
  },
  {
    id: 'op-2',
    storeId: 'store-1',
    phoneNumber: '919835054321',
    userId: null,
    displayName: 'Priya Staff',
    operatorRole: 'STAFF',
    active: true,
  },
];

const sampleFlows: WhatsAppFlowTemplateResponse[] = [
  {
    id: 'flow-1',
    templateKey: 'WELCOME_MENU',
    name: 'Customer Welcome Menu',
    description: 'Interactive greeting menu allowing customers to view products and offers.',
    category: 'CUSTOMER_SERVICE',
    flowVersion: '3.1.0',
    metaFlowJson: '{"version":"3.1","screens":[]}',
  },
  {
    id: 'flow-2',
    templateKey: 'CHECKOUT',
    name: 'Instant WhatsApp Checkout',
    description: 'In-chat order placement and address collection flow.',
    category: 'ORDER_CAPTURE',
    flowVersion: '3.1.0',
    metaFlowJson: '{"version":"3.1","screens":[{"id":"CART"}]}',
  },
];

const sampleStoreSettings: Partial<StoreSettingsResponse> = {
  id: 'store-1',
  slug: 'amanly',
  name: 'Amanly Store',
  whatsappEnabled: true,
  features: ['OVERVIEW', 'CATALOG', 'SALES', 'SYSTEM'],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetStatus.mockResolvedValue(null);
  mockGetOperators.mockResolvedValue([]);
  mockGetFlows.mockResolvedValue([]);
  mockGetStore.mockResolvedValue(sampleStoreSettings as StoreSettingsResponse);
});

describe('AdminWhatsApp Hub', () => {
  it('renders disconnected state by default when no connection exists', async () => {
    renderWithProviders(<AdminWhatsApp />);

    expect(await screen.findByText('WhatsApp Management Hub')).toBeInTheDocument();
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
    expect(screen.getByText('Save & Map WhatsApp')).toBeInTheDocument();
  });

  it('renders connected state with phone number, quality rating, and disconnect action', async () => {
    mockGetStatus.mockResolvedValue(sampleConnected);
    renderWithProviders(<AdminWhatsApp />);

    expect(await screen.findByText('WhatsApp Management Hub')).toBeInTheDocument();
    expect(screen.getByText(/Connected \(\+91 98350 12345\)/)).toBeInTheDocument();
    expect(screen.getByText('Quality: GREEN')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Disconnect/i })).toBeInTheDocument();
    expect(screen.getByText('Update WhatsApp Connection')).toBeInTheDocument();
  });

  it('renders revoked/suspended badge when status is REVOKED', async () => {
    mockGetStatus.mockResolvedValue({
      ...sampleConnected,
      status: 'REVOKED',
      connected: false,
    });
    renderWithProviders(<AdminWhatsApp />);

    expect(await screen.findByText('WhatsApp Management Hub')).toBeInTheDocument();
    expect(screen.getByText('Revoked / Suspended')).toBeInTheDocument();
  });

  it('validates required fields before connecting', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminWhatsApp />);

    expect(await screen.findByText('WhatsApp Management Hub')).toBeInTheDocument();

    // Submit with empty fields
    const submitBtn = screen.getByText('Save & Map WhatsApp');
    await user.click(submitBtn);

    expect(toast.error).toHaveBeenCalledWith('Validation Error', 'Meta Phone Number ID is required.');
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('validates system user access token requirement when connecting initially', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminWhatsApp />);

    expect(await screen.findByText('WhatsApp Management Hub')).toBeInTheDocument();

    // Fill Phone ID but leave token empty
    const phoneInput = screen.getByPlaceholderText('e.g. 104928172648192');
    await user.type(phoneInput, '104928172648192');

    const submitBtn = screen.getByText('Save & Map WhatsApp');
    await user.click(submitBtn);

    expect(toast.error).toHaveBeenCalledWith(
      'Validation Error',
      'Meta System User Permanent Access Token is required to connect.'
    );
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('submits connection request with valid parameters and never persists credentials', async () => {
    const user = userEvent.setup();
    mockConnect.mockResolvedValue(sampleConnected);

    renderWithProviders(<AdminWhatsApp />);
    expect(await screen.findByText('WhatsApp Management Hub')).toBeInTheDocument();

    const phoneInput = screen.getByPlaceholderText('e.g. 104928172648192');
    const wabaInput = screen.getByPlaceholderText('e.g. 918273645129384');
    const displayInput = screen.getByPlaceholderText('e.g. +91 98350 12345');
    const tokenInput = screen.getByPlaceholderText('EAAB...');

    await user.type(phoneInput, '104928172648192');
    await user.type(wabaInput, '918273645129384');
    await user.type(displayInput, '+91 98350 12345');
    await user.type(tokenInput, 'EAAB_test_token_secret');

    const submitBtn = screen.getByText('Save & Map WhatsApp');
    await user.click(submitBtn);

    expect(mockConnect).toHaveBeenCalledWith({
      phoneNumberId: '104928172648192',
      wabaId: '918273645129384',
      displayPhoneNumber: '+91 98350 12345',
      accessToken: 'EAAB_test_token_secret',
      onboardingMethod: 'MANUAL_SYSTEM_USER',
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'WhatsApp Connected',
        'Mapped Phone Number ID 104928172648192 to this store.'
      );
    });

    // Verify token is cleared from state and never persisted in storage
    expect(tokenInput).toHaveValue('');
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('handles backend connection failure gracefully with error toast', async () => {
    const user = userEvent.setup();
    mockConnect.mockRejectedValue(new Error('Phone number already in use by another store'));

    renderWithProviders(<AdminWhatsApp />);
    expect(await screen.findByText('WhatsApp Management Hub')).toBeInTheDocument();

    const phoneInput = screen.getByPlaceholderText('e.g. 104928172648192');
    const tokenInput = screen.getByPlaceholderText('EAAB...');
    await user.type(phoneInput, '104928172648192');
    await user.type(tokenInput, 'EAAB_test');

    const submitBtn = screen.getByText('Save & Map WhatsApp');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Connection Failed',
        'Phone number already in use by another store'
      );
    });
  });

  it('triggers disconnect with confirmation dialog and executes successfully', async () => {
    const user = userEvent.setup();
    mockGetStatus.mockResolvedValue(sampleConnected);
    mockDisconnect.mockResolvedValue({
      ...sampleConnected,
      status: 'DISCONNECTED',
      connected: false,
    });

    renderWithProviders(<AdminWhatsApp />);
    expect(await screen.findByText('WhatsApp Management Hub')).toBeInTheDocument();

    const disconnectBtn = screen.getByRole('button', { name: /Disconnect/i });
    await user.click(disconnectBtn);

    // Confirm dialog appears
    expect(screen.getByText('Disconnect WhatsApp Integration?')).toBeInTheDocument();
    const confirmBtn = screen.getByRole('button', { name: 'Yes, Disconnect' });
    await user.click(confirmBtn);

    expect(mockDisconnect).toHaveBeenCalled();
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'WhatsApp Disconnected',
        'Disconnected WhatsApp integration for this store.'
      );
    });
  });

  it('renders authorized operators and allows adding new operators', async () => {
    const user = userEvent.setup();
    mockGetOperators.mockResolvedValue(sampleOperators);
    mockRegisterOperator.mockResolvedValue({
      id: 'op-3',
      storeId: 'store-1',
      phoneNumber: '919835099999',
      userId: null,
      displayName: 'Vikram Ops',
      operatorRole: 'STORE_OWNER',
      active: true,
    });

    renderWithProviders(<AdminWhatsApp />);
    expect(await screen.findByText('WhatsApp Management Hub')).toBeInTheDocument();

    // Switch to Operators tab
    const operatorsTab = screen.getByRole('tab', { name: /Store Operators/i });
    await user.click(operatorsTab);

    expect(await screen.findByText('Aman Raj')).toBeInTheDocument();
    expect(screen.getByText('Priya Staff')).toBeInTheDocument();
    expect(screen.getByText('+919835012345')).toBeInTheDocument();

    // Open Authorize Operator modal
    const authorizeBtn = screen.getByRole('button', { name: /Authorize Operator/i });
    await user.click(authorizeBtn);

    expect(screen.getByRole('heading', { name: 'Authorize WhatsApp Operator' })).toBeInTheDocument();

    const phoneInput = screen.getByPlaceholderText('919835012345');
    const nameInput = screen.getByPlaceholderText('e.g. Aman Raj');

    await user.type(phoneInput, '919835099999');
    await user.type(nameInput, 'Vikram Ops');

    const submitModalBtn = screen.getAllByRole('button', { name: 'Authorize Operator' })[1];
    await user.click(submitModalBtn);

    expect(mockRegisterOperator).toHaveBeenCalledWith({
      phoneNumber: '919835099999',
      displayName: 'Vikram Ops',
      role: 'STORE_OWNER',
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Operator Authorized',
        'Authorized Vikram Ops (+919835099999) as STORE_OWNER.'
      );
    });
  });

  it('renders central WhatsApp Flows and allows linking published Meta Flow ID', async () => {
    const user = userEvent.setup();
    mockGetFlows.mockResolvedValue(sampleFlows);
    mockDeployFlow.mockResolvedValue({
      id: 'dep-1',
      storeId: 'store-1',
      templateKey: 'WELCOME_MENU',
      metaFlowId: '109876543212345',
      deployedVersion: '3.1.0',
    });

    renderWithProviders(<AdminWhatsApp />);
    expect(await screen.findByText('WhatsApp Management Hub')).toBeInTheDocument();

    // Switch to Flows tab
    const flowsTab = screen.getByRole('tab', { name: /WhatsApp Flows/i });
    await user.click(flowsTab);

    expect(await screen.findByText('Customer Welcome Menu')).toBeInTheDocument();
    expect(screen.getByText('Instant WhatsApp Checkout')).toBeInTheDocument();
    expect(screen.getByText('WELCOME_MENU')).toBeInTheDocument();

    // View JSON modal
    const viewJsonBtns = screen.getAllByRole('button', { name: 'View JSON' });
    await user.click(viewJsonBtns[0]);
    expect(screen.getByText(/Meta Flow JSON: Customer Welcome Menu/)).toBeInTheDocument();

    const closeBtns = screen.getAllByRole('button', { name: /Close/i });
    await user.click(closeBtns[0]);

    // Open Link Published Flow ID modal
    const linkBtns = screen.getAllByRole('button', { name: /Link Published Flow ID/i });
    await user.click(linkBtns[0]);

    expect(screen.getByRole('heading', { name: /Link Published Flow: Customer Welcome Menu/ })).toBeInTheDocument();

    const flowIdInput = screen.getByPlaceholderText('e.g. 109876543212345');
    await user.type(flowIdInput, '109876543212345');

    const recordBtn = screen.getByRole('button', { name: 'Record Association' });
    await user.click(recordBtn);

    expect(mockDeployFlow).toHaveBeenCalledWith({
      templateKey: 'WELCOME_MENU',
      metaFlowId: '109876543212345',
      version: '3.1.0',
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Flow Linked',
        'Associated Meta Flow ID 109876543212345 to template WELCOME_MENU.'
      );
    });
  });

  it('renders diagnostics tab with webhook URL and platform security details', async () => {
    const user = userEvent.setup();
    mockGetStatus.mockResolvedValue(sampleConnected);

    renderWithProviders(<AdminWhatsApp />);
    expect(await screen.findByText('WhatsApp Management Hub')).toBeInTheDocument();

    const diagTab = screen.getByRole('tab', { name: /Diagnostics & Testing/i });
    await user.click(diagTab);

    expect(screen.getByText('Platform Webhook Security')).toBeInTheDocument();
    expect(screen.getByText('Interactive Diagnostic Simulator')).toBeInTheDocument();
    expect(screen.getByText('Remediation & Meta Troubleshooting')).toBeInTheDocument();
  });
});