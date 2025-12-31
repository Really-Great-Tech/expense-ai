# Papaya Development Guidelines

> **Purpose**: This document provides guardrails for automated code review. It focuses on common issues to prevent, not comprehensive documentation.

## 1. Logging Standards

### Log Levels - Use Correctly

- **ERROR**: Critical issues requiring immediate action. These trigger alerts and must be investigated.
  - **Target: ZERO errors in Production, Demo & Staging**
  - If you're catching an expected scenario, use WARNING instead
- **WARNING**: Expected but undesired situations that need attention
- **INFO**: Important application flow information only (not every request)
- **TRACE/DEBUG**: Local development only, never in production code

### What NOT to Log

- ❌ Personally Identifiable Information (PII) - unless properly masked (see below)
- ❌ Passwords (even hashed)
- ❌ API Keys, Tokens, Secrets (OAuth tokens, JWT tokens, API keys, database credentials)
- ❌ Complete object dumps (`object.toString()`, JSON.stringify of full objects)
- ❌ Full SQL queries (unless debugging specific issues)
- ❌ Redundant information within the same execution flow

### PII Masking Requirements

If PII must be logged for debugging, it MUST be masked according to these rules:

- **Email**: Mask middle characters, keep first and last letter of local part
  - Example: `rotembi@papayaglobal.com` → `ro*****i@papayaglobal.com`
- **Phone**: Show country code only, mask all other digits
  - Example: `+972-123456789` → `+972-***********`
- **Address**: Show city name only, redact street and apartment
  - Example: `My cool Streat 17, apt 5, My Cool City` → `***Redacted***, ***Redacted***, My Cool City`
- **Salary Details**: Fully redacted
  - Example: `$60,000` → `***Redacted***`
- **Bank Account Numbers**: Show last 4 digits only, mask all other digits
  - Example: `IL123456789012345678` → `************5678`
- **Credit Card Numbers**: Show last 4 digits only, mask all other digits
  - Example: `4580-1234-5678-9012` → `****-****-****-9012`

**Important**: Never log unmasked PII or financial data. Use masking utilities before logging.

### Secrets and Credentials - NEVER Log

The following must NEVER be logged, even partially:

- **API Keys**: AWS keys, third-party API keys, service tokens
- **Authentication Tokens**: JWT tokens, OAuth tokens, session tokens, refresh tokens
- **Credentials**: Database passwords, service account credentials
- **Secrets**: Encryption keys, signing secrets, webhook secrets

**Critical**: If you need to log authentication flow, log only:

- Token type (e.g., "Bearer token")
- Token prefix (first 4 chars only, e.g., "sk_te...")
- Token expiration time
- User/service ID associated with the token

**Never log the full token value.**

### What TO Log

- ✅ User IDs (not names, emails, or other PII)
- ✅ Masked PII when absolutely necessary for debugging
- ✅ Specific field values needed for debugging
- ✅ Exception messages with context
- ✅ Structured, parseable log messages

### Log Quality Checks

Before merging, verify:

1. No duplicate logs in the same flow
2. No sensitive data exposure
3. ERROR logs have corresponding alerts configured
4. Consider: Can this be a metric or APM trace instead of a log?

## 2. REST API Standards

### URL Design - Use Correct Patterns

- **Resources are nouns, not verbs**: `/users` not `/getUsers`
- **Use plural collections**: `/users/{userId}` not `/user/{userId}`
- **Hierarchical structure**: `/users/{userId}/orders/{orderId}`
- **No leading slash in resource names**: `users/123` not `/users/123`
- **Lowercase only**: `/users` not `/Users` or `/USERS`
- **Custom methods use colon**: `POST /users/{userId}:activate`

### HTTP Methods - Use Appropriately

- ❌ **GET** should NEVER modify data
- ✅ **POST** for creation and non-idempotent operations
- ✅ **PUT** for full replacement (idempotent)
- ✅ **PATCH** for partial updates
- ✅ **DELETE** for removal (idempotent)

### Field Naming - Use camelCase

- ✅ Use `camelCase` for all JSON fields
- ✅ Resource identifier: `name` (contains full resource name like `users/123`)
- ✅ Human-readable: `displayName`
- ✅ Timestamps: `createTime`, `updateTime`, `deleteTime` (RFC 3339 format)
- ✅ Booleans as questions: `isActive`, `hasPermission`
- ❌ Never use `snake_case` in JSON responses (except where Google AIP requires it)

### Error Responses - Follow Standard Format

All errors must include:

1. Proper HTTP status code (400, 401, 403, 404, 500, etc.)
2. Structured error response with `code`, `message`, and `details`
3. Actionable error messages
4. No sensitive data (stack traces, internal paths, DB details)

### API Security Checks

Before merging, verify:

1. **No PII in URLs or logs**: User IDs only, never names/emails
2. **Input validation**: All user input is validated server-side
3. **Proper auth checks**: Authorization verified for each endpoint
4. **HTTPS only**: No HTTP endpoints in production
5. **No sensitive data in responses**: Filter based on user permissions

## 3. When Adding Logging

**If you're logging every request received**: Consider using APM tools or custom metrics instead. Logs should provide meaningful insights, not volume.

**If you're adding ERROR logs**: Ensure an alert is configured. Every ERROR should wake someone up.

**If you're catching and logging an exception**: Ask yourself:

- Does this require immediate action? → ERROR
- Is this expected but needs monitoring? → WARNING
- Is this just informational? → INFO

## 4. When Adding/Modifying APIs

**If you're creating a new endpoint**: Ensure it follows RESTful patterns and naming conventions.

**If you're adding custom operations**: Use the `:` convention (e.g., `:activate`, `:cancel`).

**If you're returning user data**: Verify no PII is exposed beyond what the user is authorized to see.

**If the operation is long-running**: Consider implementing async operations with status polling.

## 5. Code Review Focus Areas

### For Logging Changes

- Are log levels appropriate for the situation?
- Is there any unmasked PII being logged?
- If PII is logged, is it properly masked according to requirements?
- Are any tokens, API keys, or secrets being logged?
- Are errors being logged as warnings (or vice versa)?
- Is the same information logged multiple times?
- Should this be a metric instead of a log?

### For API Changes

- Do URLs follow RESTful naming conventions?
- Are HTTP methods used correctly (GET never modifies data)?
- Are field names in camelCase?
- Do error responses include proper structure and status codes?
- Is there proper input validation and auth checks?
- Is PII properly filtered based on permissions?

---

## Language-Specific Examples

For concrete code examples in your language, see [PAPAYA_RULES_EXAMPLES.MD](./PAPAYA_RULES_EXAMPLES.MD) when:

- You need to see specific syntax for BAD vs GOOD patterns
- Reviewing code and want to reference similar anti-patterns
- The code under review matches patterns in Java, JavaScript/TypeScript, or Python

**The examples file provides detailed code snippets. This file focuses on principles.**
