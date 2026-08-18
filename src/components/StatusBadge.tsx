import { Badge } from './ui';
import type { Tone } from './ui';
import type { OrderPaymentStatus, OrderStatus, ProductStatus, UserStatus } from '@/lib/types';
import { titleCase } from '@/lib/format';

const ORDER_TONE: Record<OrderStatus, Parameters<typeof Badge>[0]['tone']> = {
  PENDING: 'amber',
  PROCESSING: 'blue',
  SHIPPED: 'purple',
  DELIVERED: 'green',
  CANCELLED: 'red',
};
/**
  * What the same status is called to the person who placed the order.
  *
  * <p>PENDING is a fulfilment state — it means staff have not picked the order yet — but read by a
  * customer it sounds like something is stuck, or worse, that their order did not go through. They
  * are told the fact they care about: it was placed. Staff keep the operational word, because that
  * is the queue they work from. The amber of a to-do item becomes the blue of something in hand.
  *
  * <p>Only the statuses whose plain name misleads are overridden; PROCESSING, SHIPPED, DELIVERED and
  * CANCELLED already say the true thing to both audiences.
  */
const CUSTOMER_ORDER_LABEL: Partial<Record<OrderStatus, string>> = {
  PENDING: 'Order placed',
};
const CUSTOMER_ORDER_TONE: Partial<Record<OrderStatus, Tone>> = {
  PENDING: 'blue',
};

export function OrderStatusBadge({
  status,
  audience = 'staff',
}: {
  status: OrderStatus;
  audience?: 'staff' | 'customer';
}) {
  const customer = audience === 'customer';
  const label = (customer && CUSTOMER_ORDER_LABEL[status]) || titleCase(status);
  const tone = (customer && CUSTOMER_ORDER_TONE[status]) || ORDER_TONE[status];
  return <Badge tone={tone}>{label}</Badge>;
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
