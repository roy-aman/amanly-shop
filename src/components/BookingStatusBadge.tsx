import { Badge, type Tone } from '@/components/ui';
import type { BookingSource, BookingStatus } from '@/lib/types';

/**
 * How a booking's state reads on screen.
 *
 * The tones carry meaning rather than decoration: confirmed is the settled,
 * good state; completed is history and deliberately quieter than confirmed, so
 * a day's list draws the eye to what is still to come; cancelled is a real
 * negative; and no-show is amber — a problem to note, not an error to alarm
 * about, and not the same thing as a customer who cancelled properly.
 */
const STATUS_TONE: Record<BookingStatus, Tone> = {
  CONFIRMED: 'green',
  COMPLETED: 'blue',
  CANCELLED: 'red',
  NO_SHOW: 'amber',
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

/**
 * Where a booking came from — console only.
 *
 * Online bookings are the norm and get the neutral tone; what a front desk
 * actually needs to spot is the walk-in or phone booking, because those may have
 * no account behind them and no email address to reach the customer on.
 */
const SOURCE_TONE: Record<BookingSource, Tone> = {
  ONLINE: 'gray',
  WALK_IN: 'purple',
  PHONE: 'blue',
};

const SOURCE_LABEL: Record<BookingSource, string> = {
  ONLINE: 'Online',
  WALK_IN: 'Walk-in',
  PHONE: 'Phone',
};

export function BookingSourceBadge({ source }: { source: BookingSource }) {
  return <Badge tone={SOURCE_TONE[source]}>{SOURCE_LABEL[source]}</Badge>;
}
