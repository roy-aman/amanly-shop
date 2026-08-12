import { Badge } from './ui';
import type { OrderPaymentStatus, OrderStatus, ProductStatus, UserStatus } from '@/lib/types';
import { titleCase } from '@/lib/format';

const ORDER_TONE: Record<OrderStatus, Parameters<typeof Badge>[0]['tone']> = {
  PENDING: 'amber',
  PROCESSING: 'blue',
  SHIPPED: 'purple',
  DELIVERED: 'green',
  CANCELLED: 'red',
};
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_TONE[status]}>{titleCase(status)}</Badge>;
}

const PAYMENT_TONE: Record<OrderPaymentStatus, Parameters<typeof Badge>[0]['tone']> = {
  PENDING: 'amber',
  PAID: 'green',
  FAILED: 'red',
  // A partial refund still leaves money with the merchant, so it reads as a
  // caution rather than a settled state like REFUNDED.
  PARTIALLY_REFUNDED: 'amber',
  REFUNDED: 'gray',
};
export function PaymentStatusBadge({ status }: { status: OrderPaymentStatus }) {
  return <Badge tone={PAYMENT_TONE[status]}>{titleCase(status)}</Badge>;
}

const PRODUCT_TONE: Record<ProductStatus, Parameters<typeof Badge>[0]['tone']> = {
  ACTIVE: 'green',
  DRAFT: 'gray',
  ARCHIVED: 'red',
};
export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return <Badge tone={PRODUCT_TONE[status]}>{titleCase(status)}</Badge>;
}

const USER_TONE: Record<UserStatus, Parameters<typeof Badge>[0]['tone']> = {
  ACTIVE: 'green',
  LOCKED: 'amber',
  DISABLED: 'red',
};
export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <Badge tone={USER_TONE[status]}>{titleCase(status)}</Badge>;
}
