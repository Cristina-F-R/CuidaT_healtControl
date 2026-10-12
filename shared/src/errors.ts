export type DomainRuleCode =
  | 'INVALID_INPUT'
  | 'FUTURE_DATE'
  | 'ITEM_NOT_FOUND'
  | 'PROFILE_NOT_FOUND'
  | 'ITEM_NOT_ACTIVE'
  | 'ITEM_NOT_ARCHIVED'
  | 'ITEM_ARCHIVED'
  | 'CATEGORY_LOCKED'
  | 'GUEST_LIMIT'
  | 'PROFILE_LAST';

/** Business rule violation raised by the shared domain. Carries a machine-readable code. */
export class DomainRuleError extends Error {
  readonly code: DomainRuleCode;

  constructor(code: DomainRuleCode, message: string) {
    super(message);
    this.name = 'DomainRuleError';
    this.code = code;
  }
}
