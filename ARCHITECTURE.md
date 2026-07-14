# Royal Commerce Frontend — Architecture & Foundation Contract

React 18 + TypeScript + Vite + Tailwind + React Router v6 + TanStack Query.
SPA served by Vite in dev (proxy `/api` → :8080); `npm run build:deploy` emits into
`../src/main/resources/static` for the Spring Boot JAR to serve same-origin.

## Golden rules for building pages

- Every page is a **default-exported** component in `src/pages/...`.
- Import ONLY from the modules listed below. Do NOT invent endpoints, fields, or exports.
- Use the shared UI kit (`@/components/ui`) — do not hand-roll buttons/inputs/cards.
- Data fetching: **TanStack Query** (`useQuery`/`useMutation`), `queryClient.invalidateQueries`.
- Errors: `catch (e) { if (e instanceof ApiError) ... }`. For forms use `e.fieldErrorMap()`
  (record keyed by field name); otherwise `toast.error('Title', e.message)`.
- Money: `money(amount, currency)`. Dates: `formatDate` / `formatDateTime` / `timeAgo`.
- Theme: dark, gold accents. Use `text-slate-*`, `bg-ink-*`, `text-gold-*`, `border-ink-*`.
- Icons: `lucide-react`.

## Exact module exports (source of truth)

### `@/lib/types` — types & enums
Enums (string unions): `RoleName` = 'CUSTOMER'|'STAFF'|'ADMIN'; `UserStatus` = 'ACTIVE'|'LOCKED'|'DISABLED';
`AuthProvider` = 'LOCAL'|'GOOGLE'; `ProductStatus` = 'DRAFT'|'ACTIVE'|'ARCHIVED';
`OrderStatus` = 'PENDING'|'PROCESSING'|'SHIPPED'|'DELIVERED'|'CANCELLED';
`OrderPaymentStatus` = 'PENDING'|'PAID'|'FAILED'|'REFUNDED'; `PaymentMethod` = 'CASH'|'UPI'|'RAZORPAY'.
Interfaces: `Page<T>` {content:T[], totalElements, totalPages, number(0-based), size, first, last, numberOfElements, empty};
`UserResponse` {id,email,fullName,provider,status,roles:RoleName[],emailVerifiedAt,createdAt,updatedAt};
`AuthResponse` {tokenType,accessToken,expiresInSeconds,refreshToken,user};
`CategoryResponse` {id,name,slug,description,parentId,parentName,depth,sortOrder,active,createdAt,updatedAt};
`CategoryTreeResponse` {id,name,slug,sortOrder,children[]};
`ProductImageResponse` {id,url,altText,sortOrder,isPrimary};
`ProductResponse` {id,name,slug,description,shortDescription,sku,price,compareAtPrice,currency,status,categoryId,categoryName,categorySlug,weight,stockQuantity,tags:string[],images[],createdAt,updatedAt};
`ProductSummaryResponse` {id,name,slug,sku,price,compareAtPrice,currency,status,categoryName,primaryImageUrl,stockQuantity};
`ProductImageRequest` {url,altText?,sortOrder,isPrimary};
`CreateProductRequest` {name,slug,sku,price,compareAtPrice?,currency,categoryId?,description?,shortDescription?,weight?,tags?,images?,stockQuantity?};
`UpdateProductRequest` {name,description?,shortDescription?,price,compareAtPrice?,currency,categoryId?,weight?,tags?,stockQuantity?} (NO slug/sku/images);
`ProductSearchParams` {categoryId?,minPrice?,maxPrice?,search?,tag?,status?,page?,size?,sort?};
`CreateCategoryRequest` {name,slug,description?,parentId?}; `UpdateCategoryRequest` {name,description?,sortOrder?,active?};
`CartItemResponse` {cartItemId,productId,productName,productSlug,sku,quantity,unitPrice,subtotal,reservationRemainingMinutes};
`CartResponse` {cartId,userId,items[],totalAmount,currency};
`ShippingDetails`/`ShippingAddressRequest` {name,phone?,addressLine1,addressLine2?,city,state?,postalCode,country};
`OrderItemResponse` {id,productId,productName,sku,unitPrice,quantity,subtotal};
`PaymentAction` {provider,razorpayKeyId,razorpayOrderId,amountMinor,currency};
`OrderResponse` {id,userId,status,paymentMethod,paymentStatus,totalAmount,currency,shippingAddress,notes,items[],paymentAction,createdAt,updatedAt};
`OrderSummaryResponse` {id,status,paymentMethod,totalAmount,currency,itemCount,shippingCity,shippingCountry,createdAt};
`PlaceOrderRequest` {shippingAddress,notes?,paymentMethod?};
`RazorpayVerifyRequest` {orderId,razorpayPaymentId,razorpayOrderId,razorpaySignature};
`PublicStoreResponse` {name,currency,codEnabled,onlinePaymentEnabled};
`StoreSettingsResponse` {id,slug,name,currency,status,codEnabled,onlinePaymentEnabled,razorpayKeyId,razorpayConfigured,whatsappEnabled};
`UpdatePaymentSettingsRequest` {codEnabled,onlinePaymentEnabled,razorpayKeyId?,razorpayKeySecret?,razorpayWebhookSecret?};
`UpdateWhatsappSettingsRequest` {enabled,phoneNumberId?,accessToken?,verifyToken?,appSecret?};
`AdminCreateUserRequest` {email,fullName,password,roles}; `ChangeUserRolesRequest` {roles};
`SavedAddress` extends ShippingDetails {id,label,isDefault}.

### `@/lib/http`
`TokenStore` {save,getAccessToken,getRefreshToken,getUser,setUser,isExpired,isAuthenticated,clear};
`class ApiError` {status:number, code:string, message:string, fieldViolations[], hasFieldErrors(), fieldErrorMap():Record<string,string>};
`request<T>(method,url,{body,auth,retry,signal})`, `buildQuery(params)`. (Pages rarely call these directly — use api modules.)

### `@/lib/format`
`money(amount,currency='USD')`, `formatDate(iso)`, `formatDateTime(iso)`, `titleCase(s)`, `timeAgo(iso)`.

### `@/lib/addressBook` — `addressBook` {list(), getDefault(), add(label,details,makeDefault), update(id,label,details,makeDefault), remove(id), setDefault(id)}
### `@/lib/razorpay` — `loadRazorpay(): Promise<void>`

### API modules
`@/api/auth`: login(email,password), register(email,fullName,password), logout(), forgotPassword(email), resetPassword(token,newPassword), resendEmailVerification(email), verifyEmail(token).
`@/api/users`: getCurrentUser(), updateProfile(fullName), updatePassword(currentPassword,newPassword).
`@/api/catalog`: listProducts(params):Page<ProductSummaryResponse>, getProduct(slug):ProductResponse, listCategories():CategoryResponse[], getCategoryTree():CategoryTreeResponse[], getCategory(slug).
`@/api/cart`: getCart(), addToCart(productId,quantity), updateCartItem(productId,quantity), removeCartItem(productId), clearCart().
`@/api/orders`: placeOrder(body):OrderResponse, listOrders({page,size,sort}):Page<OrderSummaryResponse>, getOrder(id):OrderResponse, cancelOrder(id):OrderResponse, verifyRazorpayPayment(body):OrderResponse.
`@/api/store`: getPublicStore():PublicStoreResponse.
`@/api/admin`:
  `adminProducts`.{list(params):Page<ProductSummaryResponse>, get(id), create(body), update(id,body), changeStatus(id,status), setStock(id,quantity), addImages(id,images[]), deleteImage(id,imageId), remove(id)};
  `adminCategories`.{list():CategoryResponse[], create(body), update(id,body), remove(id)};
  `adminOrders`.{list({page,size,sort}):Page<OrderSummaryResponse>, get(id), updateStatus(id,status)};
  `adminUsers`.{list({search,page,size,sort}):Page<UserResponse>, get(id), create(body), changeRoles(id,roles), lock(id,reason?), unlock(id), disable(id,reason?)};
  `adminStore`.{get():StoreSettingsResponse, updatePayment(body), updateWhatsapp(body)}.

### Contexts
`@/context/AuthContext` → `useAuth()`: {user, isAuthenticated, isStaff, isAdmin, loading, login(email,pw), register(email,name,pw), logout(), refreshUser(), setUser(u)}.
`@/context/CartContext` → `useCart()`: {cart, itemCount, loading, refresh(), setCart(c)}. Call `refresh()` after cart mutations.
`@/context/ToastContext` → `useToast()`: {success(t,m?), error(t,m?), info(t,m?), warning(t,m?), push(kind,t,m?)}.

### UI kit `@/components/ui`
Split into a `src/components/ui/` directory (one file per component) behind a barrel — import from `@/components/ui`
only, never a deep path. Built to `docs/design-system.md` tokens; dark-theme only; every interactive element is
keyboard-operable with the standard gold focus ring. Radix-backed components (marked ⚛) provide focus-trap/ARIA.
A dev-only `/dev/kitchen-sink` route renders all of them in every variant (mounted only when `import.meta.env.DEV`;
tree-shaken out of production).

**Core primitives (unchanged surface):**
`cn(...)`; `Button` {variant:'primary'|'secondary'|'ghost'|'danger'|'outline', size:'sm'|'md'|'lg', loading, fullWidth, ...button attrs}
(also exports `ButtonVariant`/`ButtonSize` types + `BUTTON_VARIANTS`/`BUTTON_SIZES`);
`LinkButton` {to, variant, size, fullWidth, children}; `Field` {label?, error?, hint?, required?, className?, children};
`Input`/`Textarea`/`Select` (accept `invalid?` + native attrs, className `rc-input` applied);
`PasswordInput` (like `Input`, owns its `type`, adds a show/hide toggle); `Card` {className?, children};
`Badge` {tone:'gold'|'green'|'red'|'blue'|'gray'|'amber'|'purple', children} (`Tone` type exported; now uses semantic
success/warning/danger/info tokens — zero visual change); `Spinner`, `PageLoader`;
`EmptyState` {icon?, title, message?, action?}; `Modal` {open, onClose, title, children, footer?, size?:'sm'|'md'|'lg'|'xl'}
(legacy hand-rolled dialog, kept as-is); `Pagination` {page(0-based), totalPages, onChange(page)};
`PageHeader` {title, subtitle?, action?}.

**WP-1.2 additions:**
- `Skeleton` {className?} + `SkeletonText` {lines?}, `SkeletonCard`, `SkeletonTable` {rows?, columns?}, `SkeletonDetail` — loading placeholders.
- ⚛ `Tabs` {value?/defaultValue?, onValueChange?} + `TabsList`, `TabsTrigger` {value}, `TabsContent` {value}.
- ⚛ `DropdownMenu` {trigger, align?, sideOffset?} + `DropdownMenuItem` {onSelect?, destructive?}, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuCheckboxItem` {checked?, onCheckedChange?}.
- ⚛ `Tooltip` {content, side?, sideOffset?} wrapping a focusable child; `TooltipProvider` {delayDuration?} for app-wide sharing.
- ⚛ `Drawer` {open?, onOpenChange?, side?:'left'|'right'|'top'|'bottom', title?, description?, footer?} (off-canvas Sheet; used by WP-1.3 mini-cart/mobile-nav) + `DrawerTrigger`, `DrawerClose`, `DrawerSide` type.
- ⚛ `Accordion` {type?:'single'|'multiple', collapsible?, value?/defaultValue?, onValueChange?} + `AccordionItem` {value, title}.
- `Breadcrumbs` {items:Crumb[]} where `Crumb` {label, to?} (omit `to` on the current/last crumb).
- `Stepper` {steps:Step[], current(0-based)} where `Step` {label, description?} — display-only progress.
- `DataTable<T>` {columns:Column<T>[], data, getRowKey, loading?, loadingRows?, empty?, onRowClick?, rowActions?, stickyHeader?, defaultSort?, sort?/onSortChange? (controlled), containerClassName?}; `Column<T>` {key, header, render?, sortable?, sortAccessor?, align?, className?, headerClassName?}; `SortState`/`SortDir` exported. Sorts internally unless `sort`+`onSortChange` given.
- ⚛ `ConfirmDialog` {open?, onOpenChange?, trigger?, title, description?, confirmLabel?, cancelLabel?, destructive?, loading?, onConfirm} — AlertDialog; stays open during async, caller closes via onOpenChange.
- `QuantityStepper` {value, onChange, min?, max?, step?, disabled?, size?} — clamped −/＋ numeric control.
- `PriceTag` {price, compareAtPrice?, currency?, size?, showDiscountBadge?} — shows compare-at + computed discount % only when compareAt > price.
- `RatingStars` {value, max?, size?, count?} — display-only (interactive input in WP-3.2).
- `ImageWithFallback` {src?, alt, wrapperClassName?, fallback?, ...img attrs} — graceful placeholder on missing/broken src; lazy by default.
- `Carousel` {children(slides), loop?, showDots?, showArrows?, ariaLabel?} — one-per-view, arrow-key navigable.
- `SearchInput` {defaultValue?, onSearch, delay?(300), placeholder?} — debounced, with clear button.
- `FilterChip` {children, selected?, onClick?, onRemove?} — toggle and/or removable filter pill.
- `Stat` {label, value, icon?, delta?:StatDelta, hint?} where `StatDelta` {value, suffix?, positiveIsGood?, label?} — dashboard KPI tile with trend (successor to `admin/StatCard`).
- `ThemedAreaChart`/`ThemedLineChart`/`ThemedBarChart` {data, xKey, series:ChartSeries[], height?, showGrid?, showLegend?, xTickFormatter?, yTickFormatter?, valueFormatter?} — recharts wrappers themed from tokens; `chartTheme` styles + `CHART_COLORS` palette also exported for bespoke charts.

New deps: `@radix-ui/react-{tabs,dropdown-menu,tooltip,dialog,accordion,alert-dialog}` (headless a11y primitives).

### `@/components/StatusBadge`
`OrderStatusBadge`, `PaymentStatusBadge`, `ProductStatusBadge`, `UserStatusBadge` — each takes `{status}`.

### `@/components/guards`
`RequireAuth`, `RequireStaff` (STAFF|ADMIN), `RequireAdmin` — used as route elements wrapping `<Outlet/>`.

## Canonical route map (use these exact paths in all links/navigate)

Store (in `StoreLayout`): `/` Home, `/products` catalog, `/products/:slug` detail, `/cart`, `/checkout`,
`/orders`, `/orders/:id`, `/account`, `/account/addresses`, `/account/settings`.
Auth (no layout / centered): `/login`, `/register`, `/admin/login`, `/forgot-password`, `/reset-password`,
`/verify-email`, `/oauth2-callback`.
Admin (in `AdminLayout`, guarded): `/admin` dashboard, `/admin/orders`, `/admin/orders/:id`,
`/admin/deliverables`, `/admin/inventory`, `/admin/inventory/new`, `/admin/inventory/:id`,
`/admin/categories`, `/admin/reports`, `/admin/users`, `/admin/users/:id`, `/admin/settings`,
`/admin/forbidden`.

## Backend limitations to handle gracefully (do not invent endpoints)
- No saved-address entity → use `@/lib/addressBook` (localStorage) for `/account/addresses` and to prefill checkout.
- No stats/reports endpoints → derive dashboard & reports client-side by paging `adminOrders.list` /
  `adminProducts.list` / `adminUsers.list` and aggregating.
- No order status filter on the API → fetch a page and filter client-side where needed (e.g. Deliverables).
- Product images: create via `CreateProductRequest.images`; after creation manage via
  `adminProducts.addImages` / `deleteImage`. `UpdateProductRequest` cannot change slug/sku/images.
