import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderStatusBadge } from './StatusBadge';

/**
 * PENDING is the one order status whose plain name lies to the person it is shown to.
 *
 * <p>To staff it is a queue: nobody has picked this order yet. To the customer who has just paid,
 * "Pending" reads as stuck — or as though the order never went through. They are told the fact they
 * came to check: it was placed.
 */
describe('OrderStatusBadge', () => {
  it('tells a customer their order was placed, not that it is pending', () => {
    render(<OrderStatusBadge status="PENDING" audience="customer" />);

    expect(screen.getByText('Order placed')).toBeInTheDocument();
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
  });

  /** Staff work the queue from this word; changing it for them would be changing their tooling. */
  it('keeps the operational word for staff', () => {
    render(<OrderStatusBadge status="PENDING" />);

    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('leaves the statuses that already read true to both audiences alone', () => {
    const { rerender } = render(<OrderStatusBadge status="DELIVERED" audience="customer" />);
    expect(screen.getByText('Delivered')).toBeInTheDocument();

    rerender(<OrderStatusBadge status="SHIPPED" audience="customer" />);
    expect(screen.getByText('Shipped')).toBeInTheDocument();

    rerender(<OrderStatusBadge status="CANCELLED" audience="customer" />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });
});
