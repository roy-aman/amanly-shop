import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  Flame,
  HelpCircle,
  Info,
  Layers,
  Link2,
  Lock,
  MessageCircle,
  MessagesSquare,
  Phone,
  PowerOff,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Terminal,
  Unlink,
  UserCheck,
  UserPlus,
  XCircle,
} from 'lucide-react';

import { adminStore, adminWhatsApp } from '@/api/admin';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import type {
  ConnectWhatsAppNumberRequest,
  DeployFlowRequest,
  RegisterWhatsAppOperatorRequest,
  WhatsAppFlowTemplateResponse,
  WhatsAppOperatorResponse,
} from '@/lib/types';

export default function AdminWhatsApp() {
  const qc = useQueryClient();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('connection');

  // Queries
  const statusQuery = useQuery({
    queryKey: ['admin', 'whatsapp', 'status'],
    queryFn: adminWhatsApp.getStatus,
  });

  const operatorsQuery = useQuery({
    queryKey: ['admin', 'whatsapp', 'operators'],
    queryFn: adminWhatsApp.getOperators,
  });

  const flowsQuery = useQuery({
    queryKey: ['admin', 'whatsapp', 'flows'],
    queryFn: adminWhatsApp.getFlows,
  });

  const storeQuery = useQuery({
    queryKey: ['admin', 'store'],
    queryFn: adminStore.get,
  });

  const conn = statusQuery.data;

  // Modals & Dialogs
  const [operatorModalOpen, setOperatorModalOpen] = useState(false);
  const [linkFlowModalOpen, setLinkFlowModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppFlowTemplateResponse | null>(null);
  const [viewJsonModalOpen, setViewJsonModalOpen] = useState(false);
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);

  // Connection form state
  const [phoneNumberId, setPhoneNumberId] = useState(conn?.phoneNumberId ?? '');
  const [wabaId, setWabaId] = useState(conn?.wabaId ?? '');
  const [displayPhone, setDisplayPhone] = useState(conn?.displayPhoneNumber ?? '');
  const [accessToken, setAccessToken] = useState('');

  // Sync form state if status query updates
  const syncFormWithData = () => {
    if (conn) {
      setPhoneNumberId(conn.phoneNumberId ?? '');
      setWabaId(conn.wabaId ?? '');
      setDisplayPhone(conn.displayPhoneNumber ?? '');
      setAccessToken('');
    }
  };

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: (body: ConnectWhatsAppNumberRequest) => adminWhatsApp.connect(body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin', 'whatsapp'] });
      qc.invalidateQueries({ queryKey: ['admin', 'store'] });
      toast.success('WhatsApp Connected', `Mapped Phone Number ID ${data.phoneNumberId} to this store.`);
      setAccessToken('');
    },
    onError: (err) => {
      toast.error('Connection Failed', err instanceof Error ? err.message : 'Could not map WhatsApp number.');
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: () => adminWhatsApp.disconnect(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'whatsapp'] });
      qc.invalidateQueries({ queryKey: ['admin', 'store'] });
      setDisconnectModalOpen(false);
      toast.success('WhatsApp Disconnected', 'Disconnected WhatsApp integration for this store.');
    },
    onError: (err) => {
      toast.error('Disconnect Failed', err instanceof Error ? err.message : 'Could not disconnect WhatsApp.');
    },
  });

  const handleSaveConnection = (e: FormEvent) => {
    e.preventDefault();
    if (!phoneNumberId.trim()) {
      toast.error('Validation Error', 'Meta Phone Number ID is required.');
      return;
    }
    // Prevent submitting without access token when not already connected
    if (!conn?.connected && !accessToken.trim()) {
      toast.error('Validation Error', 'Meta System User Permanent Access Token is required to connect.');
      return;
    }

    connectMutation.mutate({
      phoneNumberId: phoneNumberId.trim(),
      wabaId: wabaId.trim() || null,
      displayPhoneNumber: displayPhone.trim() || null,
      accessToken: accessToken.trim() || null,
      onboardingMethod: 'MANUAL_SYSTEM_USER',
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied', `${label} copied to clipboard.`);
  };

  const isConnected = conn?.connected || conn?.status === 'CONNECTED';

  if (statusQuery.isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp Management Hub"
        subtitle="Connect Meta WhatsApp Cloud API, manage authorized operators, and link published interactive Flows."
        action={
          <div className="flex items-center gap-3">
            {isConnected ? (
              <Badge tone="green">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Connected ({conn?.displayPhoneNumber || conn?.phoneNumberId})
              </Badge>
            ) : conn?.status === 'REVOKED' ? (
              <Badge tone="red">
                <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                Revoked / Suspended
              </Badge>
            ) : (
              <Badge tone="gray">
                <PowerOff className="h-3.5 w-3.5 text-slate-400" />
                Disconnected
              </Badge>
            )}

            {conn?.qualityRating && (
              <Badge
                tone={
                  conn.qualityRating.toUpperCase() === 'GREEN'
                    ? 'green'
                    : conn.qualityRating.toUpperCase() === 'YELLOW'
                      ? 'amber'
                      : 'red'
                }
              >
                Quality: {conn.qualityRating}
              </Badge>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                statusQuery.refetch();
                operatorsQuery.refetch();
                flowsQuery.refetch();
                storeQuery.refetch();
                toast.success('Refreshed', 'WhatsApp status and operator lists refreshed.');
              }}
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </Button>

            {isConnected && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDisconnectModalOpen(true)}
              >
                <Unlink className="h-4 w-4 mr-1.5" />
                Disconnect
              </Button>
            )}

            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/"
              target="_blank"
              rel="noreferrer"
              className="rc-btn rc-btn-secondary rc-btn-sm inline-flex items-center gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Meta Docs
            </a>
          </div>
        }
      />

      {/* Plan Entitlements Banner */}
      {storeQuery.data && (
        <Card className="p-4 border-slate-700 bg-ink-900/60 flex items-start gap-3">
          <Info className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-slate-200">
              Platform WhatsApp Entitlement Status
            </p>
            <p className="text-slate-400">
              Notifications &amp; Alerts:{' '}
              <span className="font-medium text-emerald-400">Allowed</span> &bull;
              Interactive Commerce &amp; Catalog:{' '}
              <span className="font-medium text-indigo-400">
                {storeQuery.data.features?.includes('CATALOG') ? 'Available with connected WABA' : 'Subject to plan'}
              </span>
            </p>
          </div>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="connection" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Connection &amp; Credentials
          </TabsTrigger>
          <TabsTrigger value="operators" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Store Operators ({operatorsQuery.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="flows" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            WhatsApp Flows ({flowsQuery.data?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="diagnostics" className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Diagnostics &amp; Testing
          </TabsTrigger>
        </TabsList>

        {/* â•â•â•â• TAB 1: CONNECTION â•â•â•â• */}
        <TabsContent value="connection" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left: Setup Form */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between pb-4 border-b border-ink-700">
                  <div>
                    <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-emerald-400" />
                      Meta WhatsApp Business Account (WABA) Mapping
                    </h3>
                    <p className="text-sm text-slate-400 mt-0.5">
                      Enter credentials from Meta Developer Portal &gt; WhatsApp &gt; API Setup.
                    </p>
                  </div>
                  {isConnected && (
                    <Button variant="ghost" size="sm" onClick={syncFormWithData}>
                      Reset Form
                    </Button>
                  )}
                </div>

                {/* Meta Configuration Guidance */}
                <div className="mt-4 p-3.5 rounded bg-blue-950/20 border border-blue-500/30 text-xs text-blue-200 space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-blue-300">
                    <ShieldCheck className="h-4 w-4 text-blue-400" />
                    Security Architecture &amp; System User Token
                  </div>
                  <p className="text-blue-200/90 leading-relaxed">
                    Amanus utilizes permanent <strong>Meta System User Access Tokens</strong> for secure Cloud API communication.
                    The platform Meta App Secret is managed centrally and is <em>never requested or stored in merchant settings</em>.
                  </p>
                </div>

                <form onSubmit={handleSaveConnection} className="mt-6 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Phone Number ID" required hint="Found in Meta App > WhatsApp > API Setup">
                      <Input
                        value={phoneNumberId}
                        onChange={(e) => setPhoneNumberId(e.target.value)}
                        placeholder="e.g. 104928172648192"
                      />
                    </Field>

                    <Field label="WhatsApp Business Account ID (WABA ID)" hint="Found in Meta Business Manager">
                      <Input
                        value={wabaId}
                        onChange={(e) => setWabaId(e.target.value)}
                        placeholder="e.g. 918273645129384"
                      />
                    </Field>
                  </div>

                  <Field label="Display Phone Number" hint="Customer-visible phone number with country code">
                    <Input
                      value={displayPhone}
                      onChange={(e) => setDisplayPhone(e.target.value)}
                      placeholder="e.g. +91 98350 12345"
                    />
                  </Field>

                  <Field
                    label="System User Permanent Access Token"
                    required={!isConnected}
                    hint={
                      isConnected
                        ? 'Leave blank to keep existing encrypted token. Never redisplayed after saving.'
                        : 'Permanent token from Meta Business Manager with whatsapp_business_messaging permissions.'
                    }
                  >
                    <Input
                      type="password"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder={
                        isConnected
                          ? 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢ (Leave blank to keep current)'
                          : 'EAAB...'
                      }
                      autoComplete="off"
                    />
                  </Field>

                  

                  <div className="pt-4 border-t border-ink-700 flex items-center justify-between">
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-emerald-400" />
                      Encrypted at rest with AES-256 before storage in PostgreSQL.
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="submit"
                        loading={connectMutation.isPending}
                        disabled={connectMutation.isPending}
                      >
                        <ShieldCheck className="h-4 w-4 mr-2 text-emerald-400" />
                        {isConnected ? 'Update WhatsApp Connection' : 'Save & Map WhatsApp'}
                      </Button>
                    </div>
                  </div>
                </form>
              </Card>
            </div>

            {/* Right: Meta Webhook Setup Guide */}
            <div className="space-y-6">
              <Card className="p-5 border-emerald-500/20 bg-emerald-950/10">
                <h4 className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Platform-Managed Webhook
                </h4>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Amanus centrally manages WhatsApp Cloud API webhook callbacks and HMAC-SHA256 signature verification.
                </p>
                <div className="mt-4 pt-3 border-t border-ink-800 text-[11px] text-slate-400 space-y-2">
                  <p className="text-slate-300">
                    Merchants do not need to configure webhooks or verify tokens in Meta Developer Dashboard.
                  </p>
                  <p className="flex items-center gap-1.5 text-slate-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <strong>Automatic Inbound Routing:</strong> Messages sent to your connected number route directly to your store's automated catalog and order flows.
                  </p>
                </div>
              </Card>

              <Card className="p-5">
                <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-emerald-400" />
                  Connection Diagnostics
                </h4>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-ink-800">
                    <span className="text-slate-400">Connection State:</span>
                    <span className="font-medium text-slate-200">{conn?.status ?? 'NOT_CONNECTED'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-ink-800">
                    <span className="text-slate-400">Verified Display Name:</span>
                    <span className="font-medium text-slate-200">{conn?.verifiedName ?? 'Not verified'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-ink-800">
                    <span className="text-slate-400">Quality Rating:</span>
                    <span className="font-medium text-slate-200">{conn?.qualityRating ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-ink-800">
                    <span className="text-slate-400">WABA ID:</span>
                    <span className="font-mono text-slate-200">{conn?.wabaId ?? 'None'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Onboarding Method:</span>
                    <span className="font-medium text-slate-200">{conn?.onboardingMethod ?? 'MANUAL'}</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* â•â•â•â• TAB 2: OPERATORS â•â•â•â• */}
        <TabsContent value="operators" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-100">Authorized Store Operators</h3>
              <p className="text-sm text-slate-400">
                Authorizing store owners and staff phone numbers allows them to check sales, manage inventory, and update order statuses via WhatsApp messages.
              </p>
            </div>
            <Button onClick={() => setOperatorModalOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Authorize Operator
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card className="overflow-hidden">
                {operatorsQuery.data && operatorsQuery.data.length > 0 ? (
                  <div className="divide-y divide-ink-700">
                    {operatorsQuery.data.map((op) => (
                      <div key={op.id} className="p-4 flex items-center justify-between hover:bg-ink-800/40 transition">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                            {op.displayName ? op.displayName.charAt(0).toUpperCase() : 'O'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-slate-100">{op.displayName}</h4>
                              <Badge tone={op.operatorRole === 'STORE_OWNER' ? 'green' : 'blue'}>
                                {op.operatorRole}
                              </Badge>
                              {op.active ? (
                                <Badge tone="gray">Active</Badge>
                              ) : (
                                <Badge tone="red">Suspended</Badge>
                              )}
                            </div>
                            <p className="text-xs font-mono text-slate-400 mt-0.5">+{op.phoneNumber}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Authorized
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<UserCheck className="h-10 w-10 text-slate-400" />}
                    title="No Operators Registered"
                    message="Add the store owner or staff WhatsApp phone number to enable natural-language management via chat."
                    action={
                      <Button onClick={() => setOperatorModalOpen(true)} size="sm">
                        <UserPlus className="h-4 w-4 mr-1.5" />
                        Authorize First Operator
                      </Button>
                    }
                  />
                )}
              </Card>

              <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-slate-400" />
                Note: Deletion of authorized operators is managed via platform administration or updating operator status.
              </p>
            </div>

            {/* Operator Commands Guide */}
            <div>
              <Card className="p-5 border-blue-500/20 bg-blue-950/10 space-y-4">
                <h4 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-blue-400" />
                  Operator Command Cheat Sheet
                </h4>
                <p className="text-xs text-slate-300">
                  Operators can text these natural-language commands directly to the store WhatsApp number:
                </p>

                <div className="space-y-3 text-xs">
                  <div className="p-2.5 rounded bg-ink-950/80 border border-ink-800">
                    <p className="font-semibold text-emerald-300">Pricing Updates:</p>
                    <p className="text-slate-300 font-mono mt-1">&bull; &quot;Set the price of rice to 80&quot;</p>
                    <p className="text-slate-300 font-mono">&bull; &quot;Change price of bread to 45&quot;</p>
                    <p className="text-[11px] text-slate-400 mt-1"><em>Requires reply YES to confirm preview</em></p>
                  </div>

                  <div className="p-2.5 rounded bg-ink-950/80 border border-ink-800">
                    <p className="font-semibold text-emerald-300">Stock &amp; Inventory:</p>
                    <p className="text-slate-300 font-mono mt-1">&bull; &quot;We received 50 packets of Maggi&quot;</p>
                    <p className="text-slate-300 font-mono">&bull; &quot;Reduce the stock of milk by 10&quot;</p>
                    <p className="text-slate-300 font-mono">&bull; &quot;Show products that are out of stock&quot;</p>
                  </div>

                  <div className="p-2.5 rounded bg-ink-950/80 border border-ink-800">
                    <p className="font-semibold text-emerald-300">Order Management &amp; Sales:</p>
                    <p className="text-slate-300 font-mono mt-1">&bull; &quot;Show today&#39;s orders&quot;</p>
                    <p className="text-slate-300 font-mono">&bull; &quot;Accept order ORD-1042&quot;</p>
                    <p className="text-slate-300 font-mono">&bull; &quot;Mark order ORD-1042 as ready&quot;</p>
                    <p className="text-slate-300 font-mono">&bull; &quot;Show today&#39;s sales&quot;</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* â•â•â•â• TAB 3: FLOWS â•â•â•â• */}
        <TabsContent value="flows" className="space-y-6">
          <div className="p-4 rounded border border-indigo-500/30 bg-indigo-950/20 text-xs text-indigo-200 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-indigo-300">
              <Info className="h-4 w-4 text-indigo-400" />
              Meta Flow Publication Requirement
            </div>
            <p className="text-indigo-200/90 leading-relaxed">
              Amanus centrally creates and versions Meta Flow JSON templates. Flows must first be published in your
              <strong> Meta WhatsApp Business Manager &gt; Flows</strong>. Once published by Meta, register the resulting
              <strong> Meta Flow ID</strong> below to connect the flow with your store.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {flowsQuery.data?.map((flow) => (
              <Card key={flow.id} className="p-5 flex flex-col justify-between hover:border-slate-600 transition">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-slate-100 text-sm">{flow.name}</h4>
                    <Badge tone="purple">
                      v{flow.flowVersion}
                    </Badge>
                  </div>
                  <p className="text-xs font-mono text-emerald-400 mt-1">{flow.templateKey}</p>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">{flow.description}</p>
                </div>

                <div className="mt-4 pt-4 border-t border-ink-700 flex items-center justify-between">
                  <Badge tone="gray">
                    {flow.category}
                  </Badge>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedTemplate(flow);
                        setViewJsonModalOpen(true);
                      }}
                    >
                      View JSON
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSelectedTemplate(flow);
                        setLinkFlowModalOpen(true);
                      }}
                    >
                      <Link2 className="h-3.5 w-3.5 mr-1" />
                      Link Published Flow ID
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* â•â•â•â• TAB 4: DIAGNOSTICS & TESTING â•â•â•â• */}
        <TabsContent value="diagnostics" className="space-y-6">
          <DiagnosticsTab conn={conn} />
        </TabsContent>
      </Tabs>

      {/* â•â•â•â• MODAL: REGISTER OPERATOR â•â•â•â• */}
      <RegisterOperatorModal
        open={operatorModalOpen}
        onClose={() => setOperatorModalOpen(false)}
        onSaved={() => {
          setOperatorModalOpen(false);
          operatorsQuery.refetch();
        }}
      />

      {/* â•â•â•â• MODAL: LINK PUBLISHED FLOW â•â•â•â• */}
      {selectedTemplate && (
        <LinkFlowModal
          open={linkFlowModalOpen}
          template={selectedTemplate}
          onClose={() => setLinkFlowModalOpen(false)}
          onLinked={() => {
            setLinkFlowModalOpen(false);
            flowsQuery.refetch();
          }}
        />
      )}

      {/* â•â•â•â• MODAL: VIEW FLOW JSON â•â•â•â• */}
      {selectedTemplate && (
        <ViewFlowJsonModal
          open={viewJsonModalOpen}
          template={selectedTemplate}
          onClose={() => setViewJsonModalOpen(false)}
        />
      )}

      {/* â•â•â•â• CONFIRM DIALOG: DISCONNECT â•â•â•â• */}
      <ConfirmDialog
        open={disconnectModalOpen}
        onOpenChange={setDisconnectModalOpen}
        title="Disconnect WhatsApp Integration?"
        description="This will remove stored credentials and cease processing WhatsApp orders, customer conversations, and operator commands for this store. You can reconnect anytime with valid Meta credentials."
        confirmLabel="Yes, Disconnect"
        destructive={true}
        loading={disconnectMutation.isPending}
        onConfirm={() => disconnectMutation.mutate()}
      />
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Subcomponent: Register Operator Modal
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function RegisterOperatorModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'STORE_OWNER' | 'STAFF'>('STORE_OWNER');

  const mutation = useMutation({
    mutationFn: (body: RegisterWhatsAppOperatorRequest) => adminWhatsApp.registerOperator(body),
    onSuccess: (data) => {
      toast.success('Operator Authorized', `Authorized ${data.displayName} (+${data.phoneNumber}) as ${data.operatorRole}.`);
      setPhone('');
      setName('');
      onSaved();
    },
    onError: (err) => {
      toast.error('Authorization Failed', err instanceof Error ? err.message : 'Could not register operator.');
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 7) {
      toast.error('Validation Error', 'Enter a valid phone number with country code (e.g. 919835012345).');
      return;
    }
    if (!name.trim()) {
      toast.error('Validation Error', 'Operator display name is required.');
      return;
    }

    mutation.mutate({
      phoneNumber: cleanPhone,
      displayName: name.trim(),
      role,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Authorize WhatsApp Operator">
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-xs text-slate-300">
          Enter the personal WhatsApp phone number of the owner or staff member who will manage the store via chat.
        </p>

        <Field label="Phone Number" required hint="Include country code, no + or spaces (e.g. 919835012345)">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="919835012345"
          />
        </Field>

        <Field label="Display Name" required hint="For identification in logs and notifications">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aman Raj"
          />
        </Field>

        <Field label="Operator Role" hint="Store owners have full pricing and stock authority; staff has inventory access">
          <Select value={role} onChange={(e) => setRole(e.target.value as 'STORE_OWNER' | 'STAFF')}>
            <option value="STORE_OWNER">STORE_OWNER (Full control: stock, pricing, sales)</option>
            <option value="STAFF">STAFF (Inventory, orders, product lookups)</option>
          </Select>
        </Field>

        <div className="pt-4 border-t border-ink-700 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending} disabled={mutation.isPending}>
            Authorize Operator
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Subcomponent: Link Published Flow Modal
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function LinkFlowModal({
  open,
  template,
  onClose,
  onLinked,
}: {
  open: boolean;
  template: WhatsAppFlowTemplateResponse;
  onClose: () => void;
  onLinked: () => void;
}) {
  const toast = useToast();
  const [metaFlowId, setMetaFlowId] = useState('');

  const mutation = useMutation({
    mutationFn: (body: DeployFlowRequest) => adminWhatsApp.deployFlow(body),
    onSuccess: () => {
      toast.success('Flow Linked', `Associated Meta Flow ID ${metaFlowId} to template ${template.templateKey}.`);
      setMetaFlowId('');
      onLinked();
    },
    onError: (err) => {
      toast.error('Association Failed', err instanceof Error ? err.message : 'Could not associate Flow ID.');
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!metaFlowId.trim()) {
      toast.error('Validation Error', 'Meta-assigned Flow ID is required.');
      return;
    }
    mutation.mutate({
      templateKey: template.templateKey,
      metaFlowId: metaFlowId.trim(),
      version: template.flowVersion,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={`Link Published Flow: ${template.name}`}>
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-xs text-slate-300">
          After importing and publishing this template in your Meta WhatsApp Manager, enter the verified <strong>Meta Flow ID</strong>:
        </p>

        <Field label="Meta Flow ID" required hint="Found in WhatsApp Manager > Account Tools > Flows">
          <Input
            value={metaFlowId}
            onChange={(e) => setMetaFlowId(e.target.value)}
            placeholder="e.g. 109876543212345"
          />
        </Field>

        <div className="p-3 bg-ink-950 rounded border border-ink-800 text-xs space-y-1">
          <p className="font-semibold text-slate-200">Template Specifications:</p>
          <p className="text-slate-400">Key: <span className="font-mono text-emerald-400">{template.templateKey}</span></p>
          <p className="text-slate-400">Flow Version: <span className="font-mono text-slate-200">{template.flowVersion}</span></p>
          <p className="text-slate-400">Category: <span className="text-slate-200">{template.category}</span></p>
        </div>

        <div className="pt-4 border-t border-ink-700 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending} disabled={mutation.isPending}>
            Record Association
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Subcomponent: View Flow JSON Modal
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function ViewFlowJsonModal({
  open,
  template,
  onClose,
}: {
  open: boolean;
  template: WhatsAppFlowTemplateResponse;
  onClose: () => void;
}) {
  const toast = useToast();

  const copyJson = () => {
    navigator.clipboard.writeText(template.metaFlowJson);
    toast.success('Copied JSON', 'Meta Flow JSON copied to clipboard. You can paste it into Meta Flows Playground.');
  };

  return (
    <Modal open={open} onClose={onClose} title={`Meta Flow JSON: ${template.name}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Version <span className="font-mono text-slate-200">{template.flowVersion}</span> &bull; {template.category}
          </div>
          <Button size="sm" variant="secondary" onClick={copyJson}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copy JSON for Playground
          </Button>
        </div>

        <pre className="max-h-96 overflow-y-auto p-4 rounded bg-ink-950 border border-ink-800 text-[11px] font-mono text-emerald-300">
          {(() => {
            try {
              return JSON.stringify(JSON.parse(template.metaFlowJson), null, 2);
            } catch {
              return template.metaFlowJson;
            }
          })()}
        </pre>

        <div className="pt-2 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Subcomponent: Diagnostics Tab
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function DiagnosticsTab({
  conn,
}: {
  conn: any;
}) {
  const toast = useToast();
  const [testMessage, setTestMessage] = useState('What is the price of milk?');
  const [simLog, setSimLog] = useState<Array<{ time: string; text: string; status: string }>>([]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied', `${label} copied to clipboard.`);
  };

  const handleRunTest = () => {
    if (!testMessage.trim()) return;
    const now = new Date().toLocaleTimeString();
    setSimLog((prev) => [
      ...prev,
      {
        time: now,
        text: testMessage,
        status: conn?.connected ? 'Delivered to Router' : 'Store Disconnected (Offline)',
      },
    ]);
    toast.success('Simulation Recorded', `Test query recorded for diagnostics.`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5 space-y-4">
          <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Platform Webhook Security
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            All incoming Meta webhook payloads are validated using SHA-256 HMAC signatures using the platform Meta App Secret. Unsigned or invalid requests are rejected with HTTP 401.
          </p>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded bg-ink-950 border border-ink-800 flex justify-between items-center">
              <span className="text-slate-400">Webhook Status:</span>
              <span className="font-mono text-emerald-400 text-[11px]">Managed by Amanus Platform</span>
            </div>
            <div className="p-2.5 rounded bg-ink-950 border border-ink-800 flex justify-between items-center">
              <span className="text-slate-400">Signature Verification:</span>
              <span className="font-mono text-slate-200 text-[11px]">Platform App Secret (HMAC-SHA256)</span>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Bot className="h-4 w-4 text-emerald-400" />
            Remediation &amp; Meta Troubleshooting
          </h4>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">&bull;</span>
              <span><strong>Invalid Token:</strong> Ensure your System User has <code>whatsapp_business_messaging</code> and <code>whatsapp_business_management</code>.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">&bull;</span>
              <span><strong>WABA Mismatch:</strong> The Phone Number ID must belong directly to the provided WABA ID.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400 font-bold">&bull;</span>
              <span><strong>Phone Number Status:</strong> Ensure your phone number is verified and active in Meta WhatsApp Business Manager.</span>
            </li>
          </ul>
        </Card>
      </div>

      <Card className="p-5 space-y-4">
        <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Terminal className="h-4 w-4 text-emerald-400" />
          Interactive Diagnostic Simulator
        </h4>
        <p className="text-xs text-slate-400">
          Test sample inbound command dispatch against the current connection state.
        </p>

        <div className="flex gap-2">
          <Input
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="Type sample query or command..."
            className="flex-1"
          />
          <Button size="sm" onClick={handleRunTest}>
            <Send className="h-3.5 w-3.5 mr-1.5" />
            Simulate
          </Button>
        </div>

        {simLog.length > 0 && (
          <div className="mt-4 p-3 rounded bg-ink-950 border border-ink-800 space-y-2 max-h-60 overflow-y-auto font-mono text-xs">
            {simLog.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-slate-300 border-b border-ink-800/50 pb-1">
                <span>[{item.time}] &quot;{item.text}&quot;</span>
                <span className={item.status.includes('Delivered') ? 'text-emerald-400' : 'text-amber-400'}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}