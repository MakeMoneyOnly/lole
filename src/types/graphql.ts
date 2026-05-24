import { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import { GraphQLContext } from '@/lib/graphql/context';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = {
    [_ in K]?: never;
};
export type Incremental<T> =
    | T
    | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
    ID: { input: string; output: string };
    String: { input: string; output: string };
    Boolean: { input: boolean; output: boolean };
    Int: { input: number; output: number };
    Float: { input: number; output: number };
    JSON: { input: Record<string, unknown>; output: Record<string, unknown> };
};

export type AdjustPointsInput = {
    accountId: Scalars['ID']['input'];
    points: Scalars['Int']['input'];
    reason: Scalars['String']['input'];
};

export type CancelOrderResult = {
    __typename?: 'CancelOrderResult';
    error?: Maybe<loleError>;
    order?: Maybe<Order>;
    success: Scalars['Boolean']['output'];
};

export type Category = {
    __typename?: 'Category';
    id: Scalars['ID']['output'];
    imageUrl?: Maybe<Scalars['String']['output']>;
    items: Array<MenuItem>;
    kdsStation?: Maybe<Scalars['String']['output']>;
    name: Scalars['String']['output'];
    nameAm?: Maybe<Scalars['String']['output']>;
    restaurantId: Scalars['ID']['output'];
    sortOrder: Scalars['Int']['output'];
};

export type ChapaPaymentResult = {
    __typename?: 'ChapaPaymentResult';
    checkoutUrl?: Maybe<Scalars['String']['output']>;
    error?: Maybe<loleError>;
    payment?: Maybe<Payment>;
    success: Scalars['Boolean']['output'];
};

export type CreateGuestInput = {
    email?: InputMaybe<Scalars['String']['input']>;
    fullName?: InputMaybe<Scalars['String']['input']>;
    phone: Scalars['String']['input'];
    restaurantId: Scalars['ID']['input'];
};

export type CreateGuestOrderInput = {
    guestSessionId: Scalars['ID']['input'];
    idempotencyKey: Scalars['String']['input'];
    items: Array<OrderItemInput>;
    notes?: InputMaybe<Scalars['String']['input']>;
    restaurantId: Scalars['ID']['input'];
    tableId?: InputMaybe<Scalars['ID']['input']>;
};

export type CreateMenuItemInput = {
    categoryId: Scalars['ID']['input'];
    description?: InputMaybe<Scalars['String']['input']>;
    descriptionAm?: InputMaybe<Scalars['String']['input']>;
    imageUrl?: InputMaybe<Scalars['String']['input']>;
    isFeatured?: InputMaybe<Scalars['Boolean']['input']>;
    modifierGroupIds?: InputMaybe<Array<Scalars['ID']['input']>>;
    name: Scalars['String']['input'];
    nameAm?: InputMaybe<Scalars['String']['input']>;
    price: Scalars['Int']['input'];
    restaurantId: Scalars['ID']['input'];
};

export type CreateOrderInput = {
    idempotencyKey: Scalars['String']['input'];
    items: Array<OrderItemInput>;
    notes?: InputMaybe<Scalars['String']['input']>;
    restaurantId: Scalars['ID']['input'];
    tableId?: InputMaybe<Scalars['ID']['input']>;
    type: OrderType;
};

export type CreateOrderResult = {
    __typename?: 'CreateOrderResult';
    error?: Maybe<loleError>;
    order?: Maybe<Order>;
    success: Scalars['Boolean']['output'];
};

export type CreateStaffInput = {
    email?: InputMaybe<Scalars['String']['input']>;
    fullName: Scalars['String']['input'];
    phone?: InputMaybe<Scalars['String']['input']>;
    pinCode?: InputMaybe<Scalars['String']['input']>;
    restaurantId: Scalars['ID']['input'];
    role: StaffRole;
    userId: Scalars['ID']['input'];
};

export type DailyRevenueReport = {
    __typename?: 'DailyRevenueReport';
    byMethod: Array<RevenueByMethod>;
    date: Scalars['String']['output'];
    orderCount: Scalars['Int']['output'];
    totalRevenueSantim: Scalars['Int']['output'];
};

export type EnrollLoyaltyInput = {
    fullName?: InputMaybe<Scalars['String']['input']>;
    guestId: Scalars['ID']['input'];
    phone: Scalars['String']['input'];
    restaurantId: Scalars['ID']['input'];
};

export type loleError = {
    __typename?: 'loleError';
    code: Scalars['String']['output'];
    message: Scalars['String']['output'];
    messageAm?: Maybe<Scalars['String']['output']>;
};

export type Guest = {
    __typename?: 'Guest';
    email?: Maybe<Scalars['String']['output']>;
    firstVisitAt: Scalars['String']['output'];
    fullName?: Maybe<Scalars['String']['output']>;
    id: Scalars['ID']['output'];
    lastVisitAt: Scalars['String']['output'];
    lifetimeValueSantim: Scalars['Int']['output'];
    loyaltyAccount?: Maybe<LoyaltyAccount>;
    phone?: Maybe<Scalars['String']['output']>;
    restaurantId: Scalars['ID']['output'];
    visitCount: Scalars['Int']['output'];
};

export type GuestConnection = {
    __typename?: 'GuestConnection';
    edges: Array<GuestEdge>;
    pageInfo: PageInfo;
};

export type GuestEdge = {
    __typename?: 'GuestEdge';
    cursor: Scalars['String']['output'];
    node: Guest;
};

export type GuestResult = {
    __typename?: 'GuestResult';
    error?: Maybe<loleError>;
    guest?: Maybe<Guest>;
    success: Scalars['Boolean']['output'];
};

export type InitiateChapaInput = {
    amountSantim: Scalars['Int']['input'];
    customerEmail?: InputMaybe<Scalars['String']['input']>;
    customerName?: InputMaybe<Scalars['String']['input']>;
    idempotencyKey: Scalars['String']['input'];
    orderId: Scalars['ID']['input'];
};

export type InitiateTelebirrInput = {
    amountSantim: Scalars['Int']['input'];
    idempotencyKey: Scalars['String']['input'];
    orderId: Scalars['ID']['input'];
    phoneNumber?: InputMaybe<Scalars['String']['input']>;
};

export type LoyaltyAccount = {
    __typename?: 'LoyaltyAccount';
    guestId: Scalars['ID']['output'];
    id: Scalars['ID']['output'];
    pointsBalance: Scalars['Int']['output'];
    restaurantId: Scalars['ID']['output'];
    status: Scalars['String']['output'];
    tier: Scalars['String']['output'];
    transactions: Array<LoyaltyTransaction>;
};

export type LoyaltyResult = {
    __typename?: 'LoyaltyResult';
    account?: Maybe<LoyaltyAccount>;
    error?: Maybe<loleError>;
    success: Scalars['Boolean']['output'];
    transaction?: Maybe<LoyaltyTransaction>;
};

export type LoyaltyTransaction = {
    __typename?: 'LoyaltyTransaction';
    accountId: Scalars['ID']['output'];
    createdAt: Scalars['String']['output'];
    id: Scalars['ID']['output'];
    orderId?: Maybe<Scalars['ID']['output']>;
    points: Scalars['Int']['output'];
    transactionType: Scalars['String']['output'];
};

export type MenuItem = {
    __typename?: 'MenuItem';
    category?: Maybe<Category>;
    categoryId: Scalars['ID']['output'];
    description?: Maybe<Scalars['String']['output']>;
    descriptionAm?: Maybe<Scalars['String']['output']>;
    id: Scalars['ID']['output'];
    imageUrl?: Maybe<Scalars['String']['output']>;
    isAvailable: Scalars['Boolean']['output'];
    isFeatured: Scalars['Boolean']['output'];
    modifierGroups: Array<ModifierGroup>;
    name: Scalars['String']['output'];
    nameAm?: Maybe<Scalars['String']['output']>;
    price: Scalars['Int']['output'];
    restaurantId: Scalars['ID']['output'];
};

export type MenuItemResult = {
    __typename?: 'MenuItemResult';
    error?: Maybe<loleError>;
    menuItem?: Maybe<MenuItem>;
    success: Scalars['Boolean']['output'];
};

export type ModifierGroup = {
    __typename?: 'ModifierGroup';
    id: Scalars['ID']['output'];
    maxSelect?: Maybe<Scalars['Int']['output']>;
    minSelect: Scalars['Int']['output'];
    multiSelect: Scalars['Boolean']['output'];
    name: Scalars['String']['output'];
    nameAm?: Maybe<Scalars['String']['output']>;
    options: Array<ModifierOption>;
    required: Scalars['Boolean']['output'];
};

export type ModifierOption = {
    __typename?: 'ModifierOption';
    id: Scalars['ID']['output'];
    isAvailable: Scalars['Boolean']['output'];
    name: Scalars['String']['output'];
    nameAm?: Maybe<Scalars['String']['output']>;
    priceAdjustment: Scalars['Int']['output'];
};

export type Mutation = {
    __typename?: 'Mutation';
    adjustPoints: LoyaltyResult;
    cancelOrder: CancelOrderResult;
    clockIn: StaffResult;
    clockOut: StaffResult;
    createGuest: GuestResult;
    createGuestOrder: CreateOrderResult;
    createMenuItem: MenuItemResult;
    createOrder: CreateOrderResult;
    createStaff: StaffResult;
    deactivateStaff: StaffResult;
    enrollLoyalty: LoyaltyResult;
    initiateChapaPayment: ChapaPaymentResult;
    initiateTelebirrPayment: TelebirrPaymentResult;
    markItemAvailability: MenuItemResult;
    processRefund: RefundResult;
    recordCashPayment: PaymentResult;
    redeemPoints: LoyaltyResult;
    updateMenuItem: MenuItemResult;
    updateMenuItemPrice: MenuItemResult;
    updateOrderStatus: UpdateOrderResult;
    updateStaff: StaffResult;
    verifyPin: PinVerificationResult;
};

export type MutationAdjustPointsArgs = {
    input: AdjustPointsInput;
};

export type MutationCancelOrderArgs = {
    id: Scalars['ID']['input'];
    reason?: InputMaybe<Scalars['String']['input']>;
};

export type MutationClockInArgs = {
    staffId: Scalars['ID']['input'];
};

export type MutationClockOutArgs = {
    staffId: Scalars['ID']['input'];
};

export type MutationCreateGuestArgs = {
    input: CreateGuestInput;
};

export type MutationCreateGuestOrderArgs = {
    input: CreateGuestOrderInput;
};

export type MutationCreateMenuItemArgs = {
    input: CreateMenuItemInput;
};

export type MutationCreateOrderArgs = {
    input: CreateOrderInput;
};

export type MutationCreateStaffArgs = {
    input: CreateStaffInput;
};

export type MutationDeactivateStaffArgs = {
    id: Scalars['ID']['input'];
};

export type MutationEnrollLoyaltyArgs = {
    input: EnrollLoyaltyInput;
};

export type MutationInitiateChapaPaymentArgs = {
    input: InitiateChapaInput;
};

export type MutationInitiateTelebirrPaymentArgs = {
    input: InitiateTelebirrInput;
};

export type MutationMarkItemAvailabilityArgs = {
    available: Scalars['Boolean']['input'];
    id: Scalars['ID']['input'];
};

export type MutationProcessRefundArgs = {
    input: ProcessRefundInput;
};

export type MutationRecordCashPaymentArgs = {
    input: RecordCashPaymentInput;
};

export type MutationRedeemPointsArgs = {
    input: RedeemPointsInput;
};

export type MutationUpdateMenuItemArgs = {
    id: Scalars['ID']['input'];
    input: UpdateMenuItemInput;
};

export type MutationUpdateMenuItemPriceArgs = {
    id: Scalars['ID']['input'];
    price: Scalars['Int']['input'];
};

export type MutationUpdateOrderStatusArgs = {
    input: UpdateOrderStatusInput;
};

export type MutationUpdateStaffArgs = {
    id: Scalars['ID']['input'];
    input: UpdateStaffInput;
};

export type MutationVerifyPinArgs = {
    input: VerifyPinInput;
};

export type Order = {
    __typename?: 'Order';
    createdAt: Scalars['String']['output'];
    discountAmount: Scalars['Int']['output'];
    guestId?: Maybe<Scalars['ID']['output']>;
    id: Scalars['ID']['output'];
    idempotencyKey: Scalars['String']['output'];
    items: Array<OrderItem>;
    notes?: Maybe<Scalars['String']['output']>;
    orderNumber: Scalars['String']['output'];
    restaurantId: Scalars['ID']['output'];
    staffId?: Maybe<Scalars['ID']['output']>;
    status: OrderStatus;
    tableId?: Maybe<Scalars['ID']['output']>;
    totalPrice: Scalars['Int']['output'];
    type: OrderType;
    updatedAt: Scalars['String']['output'];
};

export type OrderConnection = {
    __typename?: 'OrderConnection';
    edges: Array<OrderEdge>;
    pageInfo: PageInfo;
};

export type OrderEdge = {
    __typename?: 'OrderEdge';
    cursor: Scalars['String']['output'];
    node: Order;
};

export type OrderItem = {
    __typename?: 'OrderItem';
    id: Scalars['ID']['output'];
    itemTotal: Scalars['Int']['output'];
    kdsStation?: Maybe<Scalars['String']['output']>;
    menuItemId: Scalars['ID']['output'];
    modifiers?: Maybe<Scalars['JSON']['output']>;
    notes?: Maybe<Scalars['String']['output']>;
    orderId: Scalars['ID']['output'];
    quantity: Scalars['Int']['output'];
    restaurantId: Scalars['ID']['output'];
    status: Scalars['String']['output'];
    unitPrice: Scalars['Int']['output'];
};

export type OrderItemInput = {
    idempotencyKey: Scalars['String']['input'];
    menuItemId: Scalars['ID']['input'];
    modifiers?: InputMaybe<Scalars['JSON']['input']>;
    notes?: InputMaybe<Scalars['String']['input']>;
    quantity: Scalars['Int']['input'];
};

export type OrderStatus = 'CANCELLED' | 'CONFIRMED' | 'PENDING' | 'PREPARING' | 'READY' | 'SERVED';

export type OrderType = 'DELIVERY' | 'DINE_IN' | 'TAKEAWAY';

export type PageInfo = {
    __typename?: 'PageInfo';
    endCursor?: Maybe<Scalars['String']['output']>;
    hasNextPage: Scalars['Boolean']['output'];
    hasPreviousPage: Scalars['Boolean']['output'];
    startCursor?: Maybe<Scalars['String']['output']>;
};

export type Payment = {
    __typename?: 'Payment';
    amount: Scalars['Int']['output'];
    capturedAt?: Maybe<Scalars['String']['output']>;
    createdAt: Scalars['String']['output'];
    currencyCode: Scalars['String']['output'];
    id: Scalars['ID']['output'];
    idempotencyKey: Scalars['String']['output'];
    method: PaymentMethod;
    orderId: Scalars['ID']['output'];
    provider?: Maybe<Scalars['String']['output']>;
    providerTransactionId?: Maybe<Scalars['String']['output']>;
    restaurantId: Scalars['ID']['output'];
    status: PaymentStatus;
};

export type PaymentMethod = 'AMOLE' | 'CASH' | 'CBE_BIRR' | 'CHAPA' | 'TELEBIRR';

export type PaymentResult = {
    __typename?: 'PaymentResult';
    error?: Maybe<loleError>;
    payment?: Maybe<Payment>;
    success: Scalars['Boolean']['output'];
};

export type PaymentStatus = 'CAPTURED' | 'FAILED' | 'PENDING' | 'REFUNDED';

export type PinVerificationResult = {
    __typename?: 'PinVerificationResult';
    error?: Maybe<loleError>;
    staff?: Maybe<Staff>;
    success: Scalars['Boolean']['output'];
};

export type ProcessRefundInput = {
    amountSantim: Scalars['Int']['input'];
    paymentId: Scalars['ID']['input'];
    reason?: InputMaybe<Scalars['String']['input']>;
};

export type Query = {
    __typename?: 'Query';
    activeOrders: Array<Order>;
    categories: Array<Category>;
    category?: Maybe<Category>;
    clockedInStaff: Array<Staff>;
    dailyRevenue: DailyRevenueReport;
    guest?: Maybe<Guest>;
    guests: GuestConnection;
    kdsOrders: Array<Order>;
    loyaltyAccount?: Maybe<LoyaltyAccount>;
    loyaltyTransactions: Array<LoyaltyTransaction>;
    menuItem?: Maybe<MenuItem>;
    menuItems: Array<MenuItem>;
    order?: Maybe<Order>;
    orders: OrderConnection;
    payment?: Maybe<Payment>;
    payments: Array<Payment>;
    searchMenu: Array<MenuItem>;
    shifts: Array<Shift>;
    staff: StaffConnection;
    staffByUserId?: Maybe<Staff>;
    staffMember?: Maybe<Staff>;
    timeEntries: Array<TimeEntry>;
};

export type QueryActiveOrdersArgs = {
    restaurantId: Scalars['ID']['input'];
};

export type QueryCategoriesArgs = {
    restaurantId: Scalars['ID']['input'];
};

export type QueryCategoryArgs = {
    id: Scalars['ID']['input'];
};

export type QueryClockedInStaffArgs = {
    restaurantId: Scalars['ID']['input'];
};

export type QueryDailyRevenueArgs = {
    date: Scalars['String']['input'];
    restaurantId: Scalars['ID']['input'];
};

export type QueryGuestArgs = {
    id: Scalars['ID']['input'];
};

export type QueryGuestsArgs = {
    after?: InputMaybe<Scalars['String']['input']>;
    first?: InputMaybe<Scalars['Int']['input']>;
    restaurantId: Scalars['ID']['input'];
    search?: InputMaybe<Scalars['String']['input']>;
};

export type QueryKdsOrdersArgs = {
    restaurantId: Scalars['ID']['input'];
    station: Scalars['String']['input'];
};

export type QueryLoyaltyAccountArgs = {
    guestId: Scalars['ID']['input'];
    restaurantId: Scalars['ID']['input'];
};

export type QueryLoyaltyTransactionsArgs = {
    accountId: Scalars['ID']['input'];
    first?: InputMaybe<Scalars['Int']['input']>;
};

export type QueryMenuItemArgs = {
    id: Scalars['ID']['input'];
};

export type QueryMenuItemsArgs = {
    availableOnly?: InputMaybe<Scalars['Boolean']['input']>;
    categoryId?: InputMaybe<Scalars['ID']['input']>;
    restaurantId: Scalars['ID']['input'];
};

export type QueryOrderArgs = {
    id: Scalars['ID']['input'];
};

export type QueryOrdersArgs = {
    after?: InputMaybe<Scalars['String']['input']>;
    first?: InputMaybe<Scalars['Int']['input']>;
    restaurantId: Scalars['ID']['input'];
    status?: InputMaybe<OrderStatus>;
    tableId?: InputMaybe<Scalars['ID']['input']>;
};

export type QueryPaymentArgs = {
    id: Scalars['ID']['input'];
};

export type QueryPaymentsArgs = {
    orderId?: InputMaybe<Scalars['ID']['input']>;
    restaurantId: Scalars['ID']['input'];
};

export type QuerySearchMenuArgs = {
    query: Scalars['String']['input'];
    restaurantId: Scalars['ID']['input'];
};

export type QueryShiftsArgs = {
    endDate?: InputMaybe<Scalars['String']['input']>;
    restaurantId: Scalars['ID']['input'];
    staffId?: InputMaybe<Scalars['ID']['input']>;
    startDate?: InputMaybe<Scalars['String']['input']>;
};

export type QueryStaffArgs = {
    after?: InputMaybe<Scalars['String']['input']>;
    first?: InputMaybe<Scalars['Int']['input']>;
    restaurantId: Scalars['ID']['input'];
    role?: InputMaybe<StaffRole>;
};

export type QueryStaffByUserIdArgs = {
    userId: Scalars['ID']['input'];
};

export type QueryStaffMemberArgs = {
    id: Scalars['ID']['input'];
};

export type QueryTimeEntriesArgs = {
    endDate?: InputMaybe<Scalars['String']['input']>;
    restaurantId: Scalars['ID']['input'];
    staffId?: InputMaybe<Scalars['ID']['input']>;
    startDate?: InputMaybe<Scalars['String']['input']>;
};

export type RecordCashPaymentInput = {
    amountSantim: Scalars['Int']['input'];
    idempotencyKey: Scalars['String']['input'];
    orderId: Scalars['ID']['input'];
};

export type RedeemPointsInput = {
    accountId: Scalars['ID']['input'];
    orderId: Scalars['ID']['input'];
    points: Scalars['Int']['input'];
};

export type RefundResult = {
    __typename?: 'RefundResult';
    error?: Maybe<loleError>;
    refund?: Maybe<Payment>;
    success: Scalars['Boolean']['output'];
};

export type RevenueByMethod = {
    __typename?: 'RevenueByMethod';
    count: Scalars['Int']['output'];
    method: PaymentMethod;
    totalSantim: Scalars['Int']['output'];
};

export type Shift = {
    __typename?: 'Shift';
    breakMinutes: Scalars['Int']['output'];
    endTime?: Maybe<Scalars['String']['output']>;
    id: Scalars['ID']['output'];
    notes?: Maybe<Scalars['String']['output']>;
    restaurantId: Scalars['ID']['output'];
    staffId: Scalars['ID']['output'];
    startTime: Scalars['String']['output'];
    status: Scalars['String']['output'];
};

export type Staff = {
    __typename?: 'Staff';
    createdAt: Scalars['String']['output'];
    email?: Maybe<Scalars['String']['output']>;
    fullName: Scalars['String']['output'];
    hireDate?: Maybe<Scalars['String']['output']>;
    id: Scalars['ID']['output'];
    isActive: Scalars['Boolean']['output'];
    phone?: Maybe<Scalars['String']['output']>;
    pinCode?: Maybe<Scalars['String']['output']>;
    restaurantId: Scalars['ID']['output'];
    role: StaffRole;
    updatedAt: Scalars['String']['output'];
    userId: Scalars['ID']['output'];
};

export type StaffConnection = {
    __typename?: 'StaffConnection';
    edges: Array<StaffEdge>;
    pageInfo: PageInfo;
};

export type StaffEdge = {
    __typename?: 'StaffEdge';
    cursor: Scalars['String']['output'];
    node: Staff;
};

export type StaffResult = {
    __typename?: 'StaffResult';
    error?: Maybe<loleError>;
    staff?: Maybe<Staff>;
    success: Scalars['Boolean']['output'];
};

export type StaffRole = 'ADMIN' | 'BAR' | 'KITCHEN' | 'MANAGER' | 'OWNER' | 'WAITER';

export type TelebirrPaymentResult = {
    __typename?: 'TelebirrPaymentResult';
    error?: Maybe<loleError>;
    expiresAt?: Maybe<Scalars['String']['output']>;
    payment?: Maybe<Payment>;
    qrCode?: Maybe<Scalars['String']['output']>;
    success: Scalars['Boolean']['output'];
    ussdCode?: Maybe<Scalars['String']['output']>;
};

export type TimeEntry = {
    __typename?: 'TimeEntry';
    breakMinutes: Scalars['Int']['output'];
    clockInTime: Scalars['String']['output'];
    clockOutTime?: Maybe<Scalars['String']['output']>;
    date: Scalars['String']['output'];
    id: Scalars['ID']['output'];
    restaurantId: Scalars['ID']['output'];
    staffId: Scalars['ID']['output'];
    totalHours?: Maybe<Scalars['Float']['output']>;
};

export type UpdateMenuItemInput = {
    description?: InputMaybe<Scalars['String']['input']>;
    descriptionAm?: InputMaybe<Scalars['String']['input']>;
    imageUrl?: InputMaybe<Scalars['String']['input']>;
    isAvailable?: InputMaybe<Scalars['Boolean']['input']>;
    isFeatured?: InputMaybe<Scalars['Boolean']['input']>;
    modifierGroupIds?: InputMaybe<Array<Scalars['ID']['input']>>;
    name?: InputMaybe<Scalars['String']['input']>;
    nameAm?: InputMaybe<Scalars['String']['input']>;
    price?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateOrderResult = {
    __typename?: 'UpdateOrderResult';
    error?: Maybe<loleError>;
    order?: Maybe<Order>;
    success: Scalars['Boolean']['output'];
};

export type UpdateOrderStatusInput = {
    id: Scalars['ID']['input'];
    status: OrderStatus;
};

export type UpdateStaffInput = {
    email?: InputMaybe<Scalars['String']['input']>;
    fullName?: InputMaybe<Scalars['String']['input']>;
    isActive?: InputMaybe<Scalars['Boolean']['input']>;
    phone?: InputMaybe<Scalars['String']['input']>;
    role?: InputMaybe<StaffRole>;
};

export type VerifyPinInput = {
    pinCode: Scalars['String']['input'];
    restaurantId: Scalars['ID']['input'];
};

export type WithIndex<TObject> = TObject & Record<string, unknown>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;

export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
    resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = object, TContext = object, TArgs = object> =
    | ResolverFn<TResult, TParent, TContext, TArgs>
    | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
    parent: TParent,
    args: TArgs,
    context: TContext,
    info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
    parent: TParent,
    args: TArgs,
    context: TContext,
    info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
    parent: TParent,
    args: TArgs,
    context: TContext,
    info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<
    TResult,
    TKey extends string,
    TParent,
    TContext,
    TArgs,
> {
    subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
    resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
    subscribe: SubscriptionSubscribeFn<unknown, TParent, TContext, TArgs>;
    resolve: SubscriptionResolveFn<TResult, unknown, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
    | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
    | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<
    TResult,
    TKey extends string,
    TParent = object,
    TContext = object,
    TArgs = object,
> =
    | ((...args: unknown[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
    | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = object, TContext = object> = (
    parent: TParent,
    context: TContext,
    info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = object, TContext = object> = (
    obj: T,
    context: TContext,
    info: GraphQLResolveInfo
) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<
    TResult = object,
    TParent = object,
    TContext = object,
    TArgs = object,
> = (
    next: NextResolverFn<TResult>,
    parent: TParent,
    args: TArgs,
    context: TContext,
    info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
    AdjustPointsInput: AdjustPointsInput;
    Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
    CancelOrderResult: ResolverTypeWrapper<CancelOrderResult>;
    Category: ResolverTypeWrapper<Category>;
    ChapaPaymentResult: ResolverTypeWrapper<ChapaPaymentResult>;
    CreateGuestInput: CreateGuestInput;
    CreateGuestOrderInput: CreateGuestOrderInput;
    CreateMenuItemInput: CreateMenuItemInput;
    CreateOrderInput: CreateOrderInput;
    CreateOrderResult: ResolverTypeWrapper<CreateOrderResult>;
    CreateStaffInput: CreateStaffInput;
    DailyRevenueReport: ResolverTypeWrapper<DailyRevenueReport>;
    EnrollLoyaltyInput: EnrollLoyaltyInput;
    Float: ResolverTypeWrapper<Scalars['Float']['output']>;
    loleError: ResolverTypeWrapper<loleError>;
    Guest: ResolverTypeWrapper<Guest>;
    GuestConnection: ResolverTypeWrapper<GuestConnection>;
    GuestEdge: ResolverTypeWrapper<GuestEdge>;
    GuestResult: ResolverTypeWrapper<GuestResult>;
    ID: ResolverTypeWrapper<Scalars['ID']['output']>;
    InitiateChapaInput: InitiateChapaInput;
    InitiateTelebirrInput: InitiateTelebirrInput;
    Int: ResolverTypeWrapper<Scalars['Int']['output']>;
    JSON: ResolverTypeWrapper<Scalars['JSON']['output']>;
    LoyaltyAccount: ResolverTypeWrapper<LoyaltyAccount>;
    LoyaltyResult: ResolverTypeWrapper<LoyaltyResult>;
    LoyaltyTransaction: ResolverTypeWrapper<LoyaltyTransaction>;
    MenuItem: ResolverTypeWrapper<MenuItem>;
    MenuItemResult: ResolverTypeWrapper<MenuItemResult>;
    ModifierGroup: ResolverTypeWrapper<ModifierGroup>;
    ModifierOption: ResolverTypeWrapper<ModifierOption>;
    Mutation: ResolverTypeWrapper<object>;
    Order: ResolverTypeWrapper<Order>;
    OrderConnection: ResolverTypeWrapper<OrderConnection>;
    OrderEdge: ResolverTypeWrapper<OrderEdge>;
    OrderItem: ResolverTypeWrapper<OrderItem>;
    OrderItemInput: OrderItemInput;
    OrderStatus: OrderStatus;
    OrderType: OrderType;
    PageInfo: ResolverTypeWrapper<PageInfo>;
    Payment: ResolverTypeWrapper<Payment>;
    PaymentMethod: PaymentMethod;
    PaymentResult: ResolverTypeWrapper<PaymentResult>;
    PaymentStatus: PaymentStatus;
    PinVerificationResult: ResolverTypeWrapper<PinVerificationResult>;
    ProcessRefundInput: ProcessRefundInput;
    Query: ResolverTypeWrapper<object>;
    RecordCashPaymentInput: RecordCashPaymentInput;
    RedeemPointsInput: RedeemPointsInput;
    RefundResult: ResolverTypeWrapper<RefundResult>;
    RevenueByMethod: ResolverTypeWrapper<RevenueByMethod>;
    Shift: ResolverTypeWrapper<Shift>;
    Staff: ResolverTypeWrapper<Staff>;
    StaffConnection: ResolverTypeWrapper<StaffConnection>;
    StaffEdge: ResolverTypeWrapper<StaffEdge>;
    StaffResult: ResolverTypeWrapper<StaffResult>;
    StaffRole: StaffRole;
    String: ResolverTypeWrapper<Scalars['String']['output']>;
    TelebirrPaymentResult: ResolverTypeWrapper<TelebirrPaymentResult>;
    TimeEntry: ResolverTypeWrapper<TimeEntry>;
    UpdateMenuItemInput: UpdateMenuItemInput;
    UpdateOrderResult: ResolverTypeWrapper<UpdateOrderResult>;
    UpdateOrderStatusInput: UpdateOrderStatusInput;
    UpdateStaffInput: UpdateStaffInput;
    VerifyPinInput: VerifyPinInput;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
    AdjustPointsInput: AdjustPointsInput;
    Boolean: Scalars['Boolean']['output'];
    CancelOrderResult: CancelOrderResult;
    Category: Category;
    ChapaPaymentResult: ChapaPaymentResult;
    CreateGuestInput: CreateGuestInput;
    CreateGuestOrderInput: CreateGuestOrderInput;
    CreateMenuItemInput: CreateMenuItemInput;
    CreateOrderInput: CreateOrderInput;
    CreateOrderResult: CreateOrderResult;
    CreateStaffInput: CreateStaffInput;
    DailyRevenueReport: DailyRevenueReport;
    EnrollLoyaltyInput: EnrollLoyaltyInput;
    Float: Scalars['Float']['output'];
    loleError: loleError;
    Guest: Guest;
    GuestConnection: GuestConnection;
    GuestEdge: GuestEdge;
    GuestResult: GuestResult;
    ID: Scalars['ID']['output'];
    InitiateChapaInput: InitiateChapaInput;
    InitiateTelebirrInput: InitiateTelebirrInput;
    Int: Scalars['Int']['output'];
    JSON: Scalars['JSON']['output'];
    LoyaltyAccount: LoyaltyAccount;
    LoyaltyResult: LoyaltyResult;
    LoyaltyTransaction: LoyaltyTransaction;
    MenuItem: MenuItem;
    MenuItemResult: MenuItemResult;
    ModifierGroup: ModifierGroup;
    ModifierOption: ModifierOption;
    Mutation: object;
    Order: Order;
    OrderConnection: OrderConnection;
    OrderEdge: OrderEdge;
    OrderItem: OrderItem;
    OrderItemInput: OrderItemInput;
    PageInfo: PageInfo;
    Payment: Payment;
    PaymentResult: PaymentResult;
    PinVerificationResult: PinVerificationResult;
    ProcessRefundInput: ProcessRefundInput;
    Query: object;
    RecordCashPaymentInput: RecordCashPaymentInput;
    RedeemPointsInput: RedeemPointsInput;
    RefundResult: RefundResult;
    RevenueByMethod: RevenueByMethod;
    Shift: Shift;
    Staff: Staff;
    StaffConnection: StaffConnection;
    StaffEdge: StaffEdge;
    StaffResult: StaffResult;
    String: Scalars['String']['output'];
    TelebirrPaymentResult: TelebirrPaymentResult;
    TimeEntry: TimeEntry;
    UpdateMenuItemInput: UpdateMenuItemInput;
    UpdateOrderResult: UpdateOrderResult;
    UpdateOrderStatusInput: UpdateOrderStatusInput;
    UpdateStaffInput: UpdateStaffInput;
    VerifyPinInput: VerifyPinInput;
}>;

export type CancelOrderResultResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['CancelOrderResult'] =
        ResolversParentTypes['CancelOrderResult'],
> = ResolversObject<{
    error?: Resolver<Maybe<ResolversTypes['loleError']>, ParentType, ContextType>;
    order?: Resolver<Maybe<ResolversTypes['Order']>, ParentType, ContextType>;
    success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CategoryResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['Category'] = ResolversParentTypes['Category'],
> = ResolversObject<{
    id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    imageUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    items?: Resolver<Array<ResolversTypes['MenuItem']>, ParentType, ContextType>;
    kdsStation?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    nameAm?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    restaurantId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    sortOrder?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ChapaPaymentResultResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['ChapaPaymentResult'] =
        ResolversParentTypes['ChapaPaymentResult'],
> = ResolversObject<{
    checkoutUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    error?: Resolver<Maybe<ResolversTypes['loleError']>, ParentType, ContextType>;
    payment?: Resolver<Maybe<ResolversTypes['Payment']>, ParentType, ContextType>;
    success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CreateOrderResultResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['CreateOrderResult'] =
        ResolversParentTypes['CreateOrderResult'],
> = ResolversObject<{
    error?: Resolver<Maybe<ResolversTypes['loleError']>, ParentType, ContextType>;
    order?: Resolver<Maybe<ResolversTypes['Order']>, ParentType, ContextType>;
    success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type DailyRevenueReportResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['DailyRevenueReport'] =
        ResolversParentTypes['DailyRevenueReport'],
> = ResolversObject<{
    byMethod?: Resolver<Array<ResolversTypes['RevenueByMethod']>, ParentType, ContextType>;
    date?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    orderCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    totalRevenueSantim?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type loleErrorResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['loleError'] = ResolversParentTypes['loleError'],
> = ResolversObject<{
    code?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    messageAm?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type GuestResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['Guest'] = ResolversParentTypes['Guest'],
> = ResolversObject<{
    email?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    firstVisitAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    fullName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    lastVisitAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    lifetimeValueSantim?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    loyaltyAccount?: Resolver<Maybe<ResolversTypes['LoyaltyAccount']>, ParentType, ContextType>;
    phone?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    restaurantId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    visitCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type GuestConnectionResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['GuestConnection'] =
        ResolversParentTypes['GuestConnection'],
> = ResolversObject<{
    edges?: Resolver<Array<ResolversTypes['GuestEdge']>, ParentType, ContextType>;
    pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type GuestEdgeResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['GuestEdge'] = ResolversParentTypes['GuestEdge'],
> = ResolversObject<{
    cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    node?: Resolver<ResolversTypes['Guest'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type GuestResultResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['GuestResult'] = ResolversParentTypes['GuestResult'],
> = ResolversObject<{
    error?: Resolver<Maybe<ResolversTypes['loleError']>, ParentType, ContextType>;
    guest?: Resolver<Maybe<ResolversTypes['Guest']>, ParentType, ContextType>;
    success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface JsonScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSON'], unknown> {
    name: 'JSON';
}

export type LoyaltyAccountResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['LoyaltyAccount'] =
        ResolversParentTypes['LoyaltyAccount'],
> = ResolversObject<{
    guestId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    pointsBalance?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    restaurantId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    tier?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    transactions?: Resolver<Array<ResolversTypes['LoyaltyTransaction']>, ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type LoyaltyResultResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['LoyaltyResult'] =
        ResolversParentTypes['LoyaltyResult'],
> = ResolversObject<{
    account?: Resolver<Maybe<ResolversTypes['LoyaltyAccount']>, ParentType, ContextType>;
    error?: Resolver<Maybe<ResolversTypes['loleError']>, ParentType, ContextType>;
    success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    transaction?: Resolver<Maybe<ResolversTypes['LoyaltyTransaction']>, ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type LoyaltyTransactionResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['LoyaltyTransaction'] =
        ResolversParentTypes['LoyaltyTransaction'],
> = ResolversObject<{
    accountId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    orderId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
    points?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    transactionType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MenuItemResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['MenuItem'] = ResolversParentTypes['MenuItem'],
> = ResolversObject<{
    category?: Resolver<Maybe<ResolversTypes['Category']>, ParentType, ContextType>;
    categoryId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    descriptionAm?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    imageUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    isAvailable?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    isFeatured?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    modifierGroups?: Resolver<Array<ResolversTypes['ModifierGroup']>, ParentType, ContextType>;
    name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    nameAm?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    price?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    restaurantId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MenuItemResultResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['MenuItemResult'] =
        ResolversParentTypes['MenuItemResult'],
> = ResolversObject<{
    error?: Resolver<Maybe<ResolversTypes['loleError']>, ParentType, ContextType>;
    menuItem?: Resolver<Maybe<ResolversTypes['MenuItem']>, ParentType, ContextType>;
    success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ModifierGroupResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['ModifierGroup'] =
        ResolversParentTypes['ModifierGroup'],
> = ResolversObject<{
    id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    maxSelect?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
    minSelect?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    multiSelect?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    nameAm?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    options?: Resolver<Array<ResolversTypes['ModifierOption']>, ParentType, ContextType>;
    required?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ModifierOptionResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['ModifierOption'] =
        ResolversParentTypes['ModifierOption'],
> = ResolversObject<{
    id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    isAvailable?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    nameAm?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    priceAdjustment?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MutationResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation'],
> = ResolversObject<{
    adjustPoints?: Resolver<
        ResolversTypes['LoyaltyResult'],
        ParentType,
        ContextType,
        RequireFields<MutationAdjustPointsArgs, 'input'>
    >;
    cancelOrder?: Resolver<
        ResolversTypes['CancelOrderResult'],
        ParentType,
        ContextType,
        RequireFields<MutationCancelOrderArgs, 'id'>
    >;
    clockIn?: Resolver<
        ResolversTypes['StaffResult'],
        ParentType,
        ContextType,
        RequireFields<MutationClockInArgs, 'staffId'>
    >;
    clockOut?: Resolver<
        ResolversTypes['StaffResult'],
        ParentType,
        ContextType,
        RequireFields<MutationClockOutArgs, 'staffId'>
    >;
    createGuest?: Resolver<
        ResolversTypes['GuestResult'],
        ParentType,
        ContextType,
        RequireFields<MutationCreateGuestArgs, 'input'>
    >;
    createGuestOrder?: Resolver<
        ResolversTypes['CreateOrderResult'],
        ParentType,
        ContextType,
        RequireFields<MutationCreateGuestOrderArgs, 'input'>
    >;
    createMenuItem?: Resolver<
        ResolversTypes['MenuItemResult'],
        ParentType,
        ContextType,
        RequireFields<MutationCreateMenuItemArgs, 'input'>
    >;
    createOrder?: Resolver<
        ResolversTypes['CreateOrderResult'],
        ParentType,
        ContextType,
        RequireFields<MutationCreateOrderArgs, 'input'>
    >;
    createStaff?: Resolver<
        ResolversTypes['StaffResult'],
        ParentType,
        ContextType,
        RequireFields<MutationCreateStaffArgs, 'input'>
    >;
    deactivateStaff?: Resolver<
        ResolversTypes['StaffResult'],
        ParentType,
        ContextType,
        RequireFields<MutationDeactivateStaffArgs, 'id'>
    >;
    enrollLoyalty?: Resolver<
        ResolversTypes['LoyaltyResult'],
        ParentType,
        ContextType,
        RequireFields<MutationEnrollLoyaltyArgs, 'input'>
    >;
    initiateChapaPayment?: Resolver<
        ResolversTypes['ChapaPaymentResult'],
        ParentType,
        ContextType,
        RequireFields<MutationInitiateChapaPaymentArgs, 'input'>
    >;
    initiateTelebirrPayment?: Resolver<
        ResolversTypes['TelebirrPaymentResult'],
        ParentType,
        ContextType,
        RequireFields<MutationInitiateTelebirrPaymentArgs, 'input'>
    >;
    markItemAvailability?: Resolver<
        ResolversTypes['MenuItemResult'],
        ParentType,
        ContextType,
        RequireFields<MutationMarkItemAvailabilityArgs, 'available' | 'id'>
    >;
    processRefund?: Resolver<
        ResolversTypes['RefundResult'],
        ParentType,
        ContextType,
        RequireFields<MutationProcessRefundArgs, 'input'>
    >;
    recordCashPayment?: Resolver<
        ResolversTypes['PaymentResult'],
        ParentType,
        ContextType,
        RequireFields<MutationRecordCashPaymentArgs, 'input'>
    >;
    redeemPoints?: Resolver<
        ResolversTypes['LoyaltyResult'],
        ParentType,
        ContextType,
        RequireFields<MutationRedeemPointsArgs, 'input'>
    >;
    updateMenuItem?: Resolver<
        ResolversTypes['MenuItemResult'],
        ParentType,
        ContextType,
        RequireFields<MutationUpdateMenuItemArgs, 'id' | 'input'>
    >;
    updateMenuItemPrice?: Resolver<
        ResolversTypes['MenuItemResult'],
        ParentType,
        ContextType,
        RequireFields<MutationUpdateMenuItemPriceArgs, 'id' | 'price'>
    >;
    updateOrderStatus?: Resolver<
        ResolversTypes['UpdateOrderResult'],
        ParentType,
        ContextType,
        RequireFields<MutationUpdateOrderStatusArgs, 'input'>
    >;
    updateStaff?: Resolver<
        ResolversTypes['StaffResult'],
        ParentType,
        ContextType,
        RequireFields<MutationUpdateStaffArgs, 'id' | 'input'>
    >;
    verifyPin?: Resolver<
        ResolversTypes['PinVerificationResult'],
        ParentType,
        ContextType,
        RequireFields<MutationVerifyPinArgs, 'input'>
    >;
}>;

export type OrderResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['Order'] = ResolversParentTypes['Order'],
> = ResolversObject<{
    createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    discountAmount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    guestId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
    id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    idempotencyKey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    items?: Resolver<Array<ResolversTypes['OrderItem']>, ParentType, ContextType>;
    notes?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    orderNumber?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    restaurantId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    staffId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
    status?: Resolver<ResolversTypes['OrderStatus'], ParentType, ContextType>;
    tableId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
    totalPrice?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    type?: Resolver<ResolversTypes['OrderType'], ParentType, ContextType>;
    updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type OrderConnectionResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['OrderConnection'] =
        ResolversParentTypes['OrderConnection'],
> = ResolversObject<{
    edges?: Resolver<Array<ResolversTypes['OrderEdge']>, ParentType, ContextType>;
    pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type OrderEdgeResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['OrderEdge'] = ResolversParentTypes['OrderEdge'],
> = ResolversObject<{
    cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    node?: Resolver<ResolversTypes['Order'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type OrderItemResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['OrderItem'] = ResolversParentTypes['OrderItem'],
> = ResolversObject<{
    id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    itemTotal?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    kdsStation?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    menuItemId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    modifiers?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
    notes?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    orderId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    quantity?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    restaurantId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    unitPrice?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type PageInfoResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['PageInfo'] = ResolversParentTypes['PageInfo'],
> = ResolversObject<{
    endCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    hasNextPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    hasPreviousPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    startCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type PaymentResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['Payment'] = ResolversParentTypes['Payment'],
> = ResolversObject<{
    amount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    capturedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    currencyCode?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    idempotencyKey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    method?: Resolver<ResolversTypes['PaymentMethod'], ParentType, ContextType>;
    orderId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    provider?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    providerTransactionId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    restaurantId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    status?: Resolver<ResolversTypes['PaymentStatus'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type PaymentResultResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['PaymentResult'] =
        ResolversParentTypes['PaymentResult'],
> = ResolversObject<{
    error?: Resolver<Maybe<ResolversTypes['loleError']>, ParentType, ContextType>;
    payment?: Resolver<Maybe<ResolversTypes['Payment']>, ParentType, ContextType>;
    success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type PinVerificationResultResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['PinVerificationResult'] =
        ResolversParentTypes['PinVerificationResult'],
> = ResolversObject<{
    error?: Resolver<Maybe<ResolversTypes['loleError']>, ParentType, ContextType>;
    staff?: Resolver<Maybe<ResolversTypes['Staff']>, ParentType, ContextType>;
    success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query'],
> = ResolversObject<{
    activeOrders?: Resolver<
        Array<ResolversTypes['Order']>,
        ParentType,
        ContextType,
        RequireFields<QueryActiveOrdersArgs, 'restaurantId'>
    >;
    categories?: Resolver<
        Array<ResolversTypes['Category']>,
        ParentType,
        ContextType,
        RequireFields<QueryCategoriesArgs, 'restaurantId'>
    >;
    category?: Resolver<
        Maybe<ResolversTypes['Category']>,
        ParentType,
        ContextType,
        RequireFields<QueryCategoryArgs, 'id'>
    >;
    clockedInStaff?: Resolver<
        Array<ResolversTypes['Staff']>,
        ParentType,
        ContextType,
        RequireFields<QueryClockedInStaffArgs, 'restaurantId'>
    >;
    dailyRevenue?: Resolver<
        ResolversTypes['DailyRevenueReport'],
        ParentType,
        ContextType,
        RequireFields<QueryDailyRevenueArgs, 'date' | 'restaurantId'>
    >;
    guest?: Resolver<
        Maybe<ResolversTypes['Guest']>,
        ParentType,
        ContextType,
        RequireFields<QueryGuestArgs, 'id'>
    >;
    guests?: Resolver<
        ResolversTypes['GuestConnection'],
        ParentType,
        ContextType,
        RequireFields<QueryGuestsArgs, 'first' | 'restaurantId'>
    >;
    kdsOrders?: Resolver<
        Array<ResolversTypes['Order']>,
        ParentType,
        ContextType,
        RequireFields<QueryKdsOrdersArgs, 'restaurantId' | 'station'>
    >;
    loyaltyAccount?: Resolver<
        Maybe<ResolversTypes['LoyaltyAccount']>,
        ParentType,
        ContextType,
        RequireFields<QueryLoyaltyAccountArgs, 'guestId' | 'restaurantId'>
    >;
    loyaltyTransactions?: Resolver<
        Array<ResolversTypes['LoyaltyTransaction']>,
        ParentType,
        ContextType,
        RequireFields<QueryLoyaltyTransactionsArgs, 'accountId' | 'first'>
    >;
    menuItem?: Resolver<
        Maybe<ResolversTypes['MenuItem']>,
        ParentType,
        ContextType,
        RequireFields<QueryMenuItemArgs, 'id'>
    >;
    menuItems?: Resolver<
        Array<ResolversTypes['MenuItem']>,
        ParentType,
        ContextType,
        RequireFields<QueryMenuItemsArgs, 'restaurantId'>
    >;
    order?: Resolver<
        Maybe<ResolversTypes['Order']>,
        ParentType,
        ContextType,
        RequireFields<QueryOrderArgs, 'id'>
    >;
    orders?: Resolver<
        ResolversTypes['OrderConnection'],
        ParentType,
        ContextType,
        RequireFields<QueryOrdersArgs, 'first' | 'restaurantId'>
    >;
    payment?: Resolver<
        Maybe<ResolversTypes['Payment']>,
        ParentType,
        ContextType,
        RequireFields<QueryPaymentArgs, 'id'>
    >;
    payments?: Resolver<
        Array<ResolversTypes['Payment']>,
        ParentType,
        ContextType,
        RequireFields<QueryPaymentsArgs, 'restaurantId'>
    >;
    searchMenu?: Resolver<
        Array<ResolversTypes['MenuItem']>,
        ParentType,
        ContextType,
        RequireFields<QuerySearchMenuArgs, 'query' | 'restaurantId'>
    >;
    shifts?: Resolver<
        Array<ResolversTypes['Shift']>,
        ParentType,
        ContextType,
        RequireFields<QueryShiftsArgs, 'restaurantId'>
    >;
    staff?: Resolver<
        ResolversTypes['StaffConnection'],
        ParentType,
        ContextType,
        RequireFields<QueryStaffArgs, 'first' | 'restaurantId'>
    >;
    staffByUserId?: Resolver<
        Maybe<ResolversTypes['Staff']>,
        ParentType,
        ContextType,
        RequireFields<QueryStaffByUserIdArgs, 'userId'>
    >;
    staffMember?: Resolver<
        Maybe<ResolversTypes['Staff']>,
        ParentType,
        ContextType,
        RequireFields<QueryStaffMemberArgs, 'id'>
    >;
    timeEntries?: Resolver<
        Array<ResolversTypes['TimeEntry']>,
        ParentType,
        ContextType,
        RequireFields<QueryTimeEntriesArgs, 'restaurantId'>
    >;
}>;

export type RefundResultResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['RefundResult'] = ResolversParentTypes['RefundResult'],
> = ResolversObject<{
    error?: Resolver<Maybe<ResolversTypes['loleError']>, ParentType, ContextType>;
    refund?: Resolver<Maybe<ResolversTypes['Payment']>, ParentType, ContextType>;
    success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type RevenueByMethodResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['RevenueByMethod'] =
        ResolversParentTypes['RevenueByMethod'],
> = ResolversObject<{
    count?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    method?: Resolver<ResolversTypes['PaymentMethod'], ParentType, ContextType>;
    totalSantim?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ShiftResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['Shift'] = ResolversParentTypes['Shift'],
> = ResolversObject<{
    breakMinutes?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    endTime?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    notes?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    restaurantId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    staffId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    startTime?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type StaffResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['Staff'] = ResolversParentTypes['Staff'],
> = ResolversObject<{
    createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    email?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    fullName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    hireDate?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    phone?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    pinCode?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    restaurantId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    role?: Resolver<ResolversTypes['StaffRole'], ParentType, ContextType>;
    updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type StaffConnectionResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['StaffConnection'] =
        ResolversParentTypes['StaffConnection'],
> = ResolversObject<{
    edges?: Resolver<Array<ResolversTypes['StaffEdge']>, ParentType, ContextType>;
    pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type StaffEdgeResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['StaffEdge'] = ResolversParentTypes['StaffEdge'],
> = ResolversObject<{
    cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    node?: Resolver<ResolversTypes['Staff'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type StaffResultResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['StaffResult'] = ResolversParentTypes['StaffResult'],
> = ResolversObject<{
    error?: Resolver<Maybe<ResolversTypes['loleError']>, ParentType, ContextType>;
    staff?: Resolver<Maybe<ResolversTypes['Staff']>, ParentType, ContextType>;
    success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TelebirrPaymentResultResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['TelebirrPaymentResult'] =
        ResolversParentTypes['TelebirrPaymentResult'],
> = ResolversObject<{
    error?: Resolver<Maybe<ResolversTypes['loleError']>, ParentType, ContextType>;
    expiresAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    payment?: Resolver<Maybe<ResolversTypes['Payment']>, ParentType, ContextType>;
    qrCode?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    ussdCode?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TimeEntryResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['TimeEntry'] = ResolversParentTypes['TimeEntry'],
> = ResolversObject<{
    breakMinutes?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
    clockInTime?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    clockOutTime?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
    date?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
    id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    restaurantId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    staffId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
    totalHours?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type UpdateOrderResultResolvers<
    ContextType = GraphQLContext,
    ParentType extends ResolversParentTypes['UpdateOrderResult'] =
        ResolversParentTypes['UpdateOrderResult'],
> = ResolversObject<{
    error?: Resolver<Maybe<ResolversTypes['loleError']>, ParentType, ContextType>;
    order?: Resolver<Maybe<ResolversTypes['Order']>, ParentType, ContextType>;
    success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
    __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type Resolvers<ContextType = GraphQLContext> = ResolversObject<{
    CancelOrderResult?: CancelOrderResultResolvers<ContextType>;
    Category?: CategoryResolvers<ContextType>;
    ChapaPaymentResult?: ChapaPaymentResultResolvers<ContextType>;
    CreateOrderResult?: CreateOrderResultResolvers<ContextType>;
    DailyRevenueReport?: DailyRevenueReportResolvers<ContextType>;
    loleError?: loleErrorResolvers<ContextType>;
    Guest?: GuestResolvers<ContextType>;
    GuestConnection?: GuestConnectionResolvers<ContextType>;
    GuestEdge?: GuestEdgeResolvers<ContextType>;
    GuestResult?: GuestResultResolvers<ContextType>;
    JSON?: GraphQLScalarType;
    LoyaltyAccount?: LoyaltyAccountResolvers<ContextType>;
    LoyaltyResult?: LoyaltyResultResolvers<ContextType>;
    LoyaltyTransaction?: LoyaltyTransactionResolvers<ContextType>;
    MenuItem?: MenuItemResolvers<ContextType>;
    MenuItemResult?: MenuItemResultResolvers<ContextType>;
    ModifierGroup?: ModifierGroupResolvers<ContextType>;
    ModifierOption?: ModifierOptionResolvers<ContextType>;
    Mutation?: MutationResolvers<ContextType>;
    Order?: OrderResolvers<ContextType>;
    OrderConnection?: OrderConnectionResolvers<ContextType>;
    OrderEdge?: OrderEdgeResolvers<ContextType>;
    OrderItem?: OrderItemResolvers<ContextType>;
    PageInfo?: PageInfoResolvers<ContextType>;
    Payment?: PaymentResolvers<ContextType>;
    PaymentResult?: PaymentResultResolvers<ContextType>;
    PinVerificationResult?: PinVerificationResultResolvers<ContextType>;
    Query?: QueryResolvers<ContextType>;
    RefundResult?: RefundResultResolvers<ContextType>;
    RevenueByMethod?: RevenueByMethodResolvers<ContextType>;
    Shift?: ShiftResolvers<ContextType>;
    Staff?: StaffResolvers<ContextType>;
    StaffConnection?: StaffConnectionResolvers<ContextType>;
    StaffEdge?: StaffEdgeResolvers<ContextType>;
    StaffResult?: StaffResultResolvers<ContextType>;
    TelebirrPaymentResult?: TelebirrPaymentResultResolvers<ContextType>;
    TimeEntry?: TimeEntryResolvers<ContextType>;
    UpdateOrderResult?: UpdateOrderResultResolvers<ContextType>;
}>;
