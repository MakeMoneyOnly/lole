# Security Checklist for New/Changed Endpoints

Use this checklist in every API PR.

## Access Control

- [ ] Endpoint auth requirement is explicit.
- [ ] Tenant scope is enforced server-side.
- [ ] Role checks are implemented for privileged actions.

## Input and Output Safety

- [ ] Request payload validation exists (zod or equivalent).
- [ ] Unsafe input is rejected with clear error codes.
- [ ] Sensitive fields are not returned unnecessarily.

## Mutation Safety

- [ ] Write actions use idempotency where required.
- [ ] High-risk writes are audit-logged.
- [ ] State transition rules are explicit and enforced.

## Abuse and Resilience

- [ ] Rate limit policy is defined.
- [ ] Retry behavior is safe and bounded.
- [ ] Endpoint has clear conflict/error semantics.

## Secret and Data Handling

- [ ] No secrets in code or logs.
- [ ] Tokens/identifiers are not exposed accidentally.
- [ ] PII handling follows minimization principles.

## Verification

- [ ] Unit tests cover auth + validation paths.
- [ ] Integration tests cover tenant boundary checks.
