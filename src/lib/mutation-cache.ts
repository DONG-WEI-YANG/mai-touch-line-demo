/**
 * Query families that consume each mutable domain. Keeping this map in one
 * place prevents a successful staff mutation from leaving a resident screen
 * stale (or vice versa).
 */
export type MutationDomain =
  | "booking"
  | "workOrder"
  | "package"
  | "parking"
  | "invoice"
  | "announcement";

export type MutationQueryKey =
  | "bookings.myBookings"
  | "bookings.listAll"
  | "amenities.getSlots"
  | "workOrders.myOrders"
  | "workOrders.listAll"
  | "packages.myPending"
  | "packages.myAll"
  | "packages.list"
  | "parking.spots"
  | "parking.myAssignments"
  | "parking.recent"
  | "finance.invoicesList"
  | "finance.myInvoices"
  | "finance.myUnpaid"
  | "announcements.listAll"
  | "announcements.list";

export const MUTATION_CACHE_TARGETS: Record<MutationDomain, readonly MutationQueryKey[]> = {
  booking: ["bookings.myBookings", "bookings.listAll", "amenities.getSlots"],
  workOrder: ["workOrders.myOrders", "workOrders.listAll"],
  package: ["packages.myPending", "packages.myAll", "packages.list"],
  parking: ["parking.spots", "parking.myAssignments", "parking.recent"],
  invoice: ["finance.invoicesList", "finance.myInvoices", "finance.myUnpaid"],
  announcement: ["announcements.listAll", "announcements.list"],
};

export type MutationInvalidators = Partial<
  Record<MutationQueryKey, () => Promise<unknown> | unknown>
>;

interface InvalidatableQuery {
  invalidate: () => Promise<unknown>;
}

export interface MutationQueryUtils {
  bookings: {
    myBookings: InvalidatableQuery;
    listAll: InvalidatableQuery;
  };
  amenities: { getSlots: InvalidatableQuery };
  workOrders: {
    myOrders: InvalidatableQuery;
    listAll: InvalidatableQuery;
  };
  packages: {
    myPending: InvalidatableQuery;
    myAll: InvalidatableQuery;
    list: InvalidatableQuery;
  };
  parking: {
    spots: InvalidatableQuery;
    myAssignments: InvalidatableQuery;
    recent: InvalidatableQuery;
  };
  finance: {
    invoicesList: InvalidatableQuery;
    myInvoices: InvalidatableQuery;
    myUnpaid: InvalidatableQuery;
  };
  announcements: {
    listAll: InvalidatableQuery;
    list: InvalidatableQuery;
  };
}

function queryInvalidators(utils: MutationQueryUtils): MutationInvalidators {
  return {
    "bookings.myBookings": () => utils.bookings.myBookings.invalidate(),
    "bookings.listAll": () => utils.bookings.listAll.invalidate(),
    "amenities.getSlots": () => utils.amenities.getSlots.invalidate(),
    "workOrders.myOrders": () => utils.workOrders.myOrders.invalidate(),
    "workOrders.listAll": () => utils.workOrders.listAll.invalidate(),
    "packages.myPending": () => utils.packages.myPending.invalidate(),
    "packages.myAll": () => utils.packages.myAll.invalidate(),
    "packages.list": () => utils.packages.list.invalidate(),
    "parking.spots": () => utils.parking.spots.invalidate(),
    "parking.myAssignments": () => utils.parking.myAssignments.invalidate(),
    "parking.recent": () => utils.parking.recent.invalidate(),
    "finance.invoicesList": () => utils.finance.invoicesList.invalidate(),
    "finance.myInvoices": () => utils.finance.myInvoices.invalidate(),
    "finance.myUnpaid": () => utils.finance.myUnpaid.invalidate(),
    "announcements.listAll": () => utils.announcements.listAll.invalidate(),
    "announcements.list": () => utils.announcements.list.invalidate(),
  };
}

/** Refresh every consumer only after the server has confirmed a mutation. */
export async function invalidateConfirmedMutation(
  domain: MutationDomain,
  invalidators: MutationInvalidators,
): Promise<void> {
  for (const key of MUTATION_CACHE_TARGETS[domain]) {
    const invalidate = invalidators[key];
    if (!invalidate) {
      throw new Error(`Missing cache invalidator for ${key}`);
    }
    await invalidate();
  }
}

/** tRPC-aware entry point used by mutation screens. */
export function invalidateDomainCaches(
  domain: MutationDomain,
  utils: MutationQueryUtils,
): Promise<void> {
  return invalidateConfirmedMutation(domain, queryInvalidators(utils));
}

interface MutationCacheTransactionOptions {
  read: (key: MutationQueryKey) => unknown;
  restore: (key: MutationQueryKey, value: unknown) => unknown;
  invalidate?: (key: MutationQueryKey) => Promise<unknown> | unknown;
}

export interface MutationCacheTransaction {
  confirm: () => Promise<boolean>;
  rollback: () => boolean;
}

/**
 * Capture query values before an optimistic update. Call `confirm` only after
 * the mutation succeeds, or `rollback` on failure. Query values must be
 * updated immutably, matching TanStack Query's cache contract.
 */
export function beginMutationCacheTransaction(
  domain: MutationDomain,
  options: MutationCacheTransactionOptions,
): MutationCacheTransaction {
  const targets = MUTATION_CACHE_TARGETS[domain];
  const snapshots = new Map(targets.map((key) => [key, options.read(key)]));
  let state: "active" | "confirmed" | "rolled_back" = "active";

  return {
    async confirm() {
      if (state !== "active") return false;
      if (options.invalidate) {
        for (const key of targets) await options.invalidate(key);
      }
      state = "confirmed";
      return true;
    },
    rollback() {
      if (state !== "active") return false;
      for (const key of targets) options.restore(key, snapshots.get(key));
      state = "rolled_back";
      return true;
    },
  };
}
