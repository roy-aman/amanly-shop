import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import {
  Breadcrumbs,
  DataTable,
  PriceTag,
  QuantityStepper,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type Column,
} from '@/components/ui';

describe('PriceTag', () => {
  it('shows only the price when there is no compare-at', () => {
    renderWithProviders(<PriceTag price={50} currency="USD" />);
    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('renders the strike-through compare price and a computed discount %', () => {
    renderWithProviders(<PriceTag price={75} compareAtPrice={100} currency="USD" />);
    expect(screen.getByText('$75.00')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    // (100-75)/100 = 25%
    expect(screen.getByText('−25%')).toBeInTheDocument();
  });

  it('hides the compare-at when it is not greater than the price', () => {
    renderWithProviders(<PriceTag price={100} compareAtPrice={100} currency="USD" />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});

describe('QuantityStepper', () => {
  it('increments and clamps at min/max', async () => {
    const onChange = vi.fn();
    const { rerender } = renderWithProviders(<QuantityStepper value={1} onChange={onChange} min={1} max={2} />);
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(onChange).toHaveBeenCalledWith(2);

    // At min, Decrease is disabled; at max, Increase is disabled.
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    rerender(<QuantityStepper value={2} onChange={onChange} min={1} max={2} />);
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });
});

describe('Breadcrumbs', () => {
  it('marks the last crumb as the current page and links the earlier ones', () => {
    renderWithProviders(
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Catalog', to: '/products' }, { label: 'Item' }]} />,
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByText('Item')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Item' })).not.toBeInTheDocument();
  });
});

describe('Tabs (Radix-backed)', () => {
  it('shows the active panel and switches when another tab is selected', async () => {
    renderWithProviders(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">First</TabsTrigger>
          <TabsTrigger value="b">Second</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText('Panel A')).toBeInTheDocument();
    expect(screen.queryByText('Panel B')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Second' }));
    expect(screen.getByText('Panel B')).toBeInTheDocument();
  });
});

describe('DataTable', () => {
  interface Row {
    id: number;
    name: string;
  }
  const columns: Column<Row>[] = [{ key: 'name', header: 'Name', sortable: true }];

  it('renders the empty state when there is no data', () => {
    renderWithProviders(<DataTable columns={columns} data={[]} getRowKey={(r) => r.id} empty="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('sorts rows internally when a sortable header is clicked', async () => {
    const data: Row[] = [
      { id: 1, name: 'Banana' },
      { id: 2, name: 'Apple' },
    ];
    renderWithProviders(<DataTable columns={columns} data={data} getRowKey={(r) => r.id} />);
    // Ascending after first click: Apple before Banana.
    await userEvent.click(screen.getByRole('button', { name: /Name/ }));
    const cells = screen.getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Apple');
  });
});
