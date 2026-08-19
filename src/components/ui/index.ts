/* ===================================================================
   Amanly — shared UI kit (barrel)
   Small, themed primitives used across storefront & admin.

   This barrel re-exports the ENTIRE historical `@/components/ui` surface
   unchanged (so every existing `import { … } from '@/components/ui'` keeps
   working) plus the WP-1.2 component-library expansion. One file per
   component/group under ./ — import from '@/components/ui' only.
   =================================================================== */

// ── Existing surface (was ui.tsx) ─────────────────────────────────────
export { cn } from './cn';
export { Button, LinkButton, BUTTON_VARIANTS, BUTTON_SIZES } from './Button';
export type { ButtonVariant, ButtonSize } from './Button';
export { Field, Input, PasswordInput, Textarea, Select } from './Field';
export { Card } from './Card';
export { Badge } from './Badge';
export type { Tone } from './Badge';
export { Wordmark } from './Wordmark';
export { AmanlyMark } from './AmanlyMark';
export { Spinner, PageLoader } from './Spinner';
export { EmptyState } from './EmptyState';
export { Modal } from './Modal';
export { Pagination } from './Pagination';
export { PageHeader } from './PageHeader';

// ── WP-1.2 additions ──────────────────────────────────────────────────
export { Skeleton, SkeletonText, SkeletonCard, SkeletonTable, SkeletonDetail } from './Skeleton';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
export type { TabsProps } from './Tabs';
export {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from './DropdownMenu';
export { Tooltip, TooltipProvider } from './Tooltip';
export { Drawer, DrawerClose, DrawerTrigger } from './Drawer';
export type { DrawerSide } from './Drawer';
export { Accordion, AccordionItem } from './Accordion';
export { Breadcrumbs } from './Breadcrumbs';
export type { Crumb } from './Breadcrumbs';
export { Stepper } from './Stepper';
export type { Step } from './Stepper';
export { DataTable } from './DataTable';
export type { Column, DataTableProps, SortState, SortDir } from './DataTable';
export { ConfirmDialog } from './ConfirmDialog';
export { QuantityStepper } from './QuantityStepper';
export { PriceTag } from './PriceTag';
export { RatingStars, RatingInput } from './RatingStars';
export { ImageWithFallback, revealOnLoad } from './ImageWithFallback';
export { Carousel } from './Carousel';
export { SearchInput } from './SearchInput';
export { FilterChip } from './FilterChip';
export { Stat } from './Stat';
export type { StatDelta } from './Stat';
export {
  ThemedAreaChart,
  ThemedLineChart,
  ThemedBarChart,
  chartTheme,
  CHART_COLORS,
} from './ThemedChart';
export type { ChartSeries } from './ThemedChart';

// ── Booking primitives (WP-BU.1) ──────────────────────────────────────
export { DateStrip } from './DateStrip';
export { SlotPicker } from './SlotPicker';
