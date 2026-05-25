/**
 * Role enum — all allowed user roles in the system.
 * Backed by a PostgreSQL ENUM type `user_role`.
 */
export const ROLES = {
    admin: 'admin',
    encoder: 'encoder',
    viewer: 'viewer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * UserStatus enum — activation state of a profile.
 * Backed by a PostgreSQL ENUM type `user_status`.
 */
export const USER_STATUS = {
    active: 'active',
    inactive: 'inactive',
} as const;

export type UserStatus = (typeof USER_STATUS)[keyof typeof USER_STATUS];

/**
 * ItemType enum — whether an item is a standard item or a spare.
 * Backed by a PostgreSQL ENUM type `item_type`.
 */
export const ITEM_TYPE = {
    standard: 'standard',
    spare: 'spare',
} as const;

export type ItemType = (typeof ITEM_TYPE)[keyof typeof ITEM_TYPE];

// ---------------------------------------------------------------------------
// Exhaustiveness helper — use in switch statements to guarantee all enum
// members are handled at compile time.
// ---------------------------------------------------------------------------

/**
 * @example
 * switch (role) {
 *   case ROLES.admin: return handleAdmin()
 *   case ROLES.encoder: return handleEncoder()
 *   case ROLES.viewer: return handleViewer()
 *   default: return assertNever(role)
 * }
 */
export function assertNever(value: never): never {
    throw new Error(`Unhandled enum value: ${JSON.stringify(value)}`);
}

// ---------------------------------------------------------------------------
// Type-guard helpers
// ---------------------------------------------------------------------------

export function isRole(value: unknown): value is Role {
    return Object.values(ROLES).includes(value as Role);
}

export function isUserStatus(value: unknown): value is UserStatus {
    return Object.values(USER_STATUS).includes(value as UserStatus);
}

export function isItemType(value: unknown): value is ItemType {
    return Object.values(ITEM_TYPE).includes(value as ItemType);
}
