# Papaya Development Rules - Language-Specific Examples

> **Purpose**: This file contains concrete code examples showing BAD vs GOOD patterns for logging. For high-level principles and API standards, see [PAPAYA_RULES_FOR_DEVELOPMENT.MD](./PAPAYA_RULES_FOR_DEVELOPMENT.MD).

## Table of Contents

- [Java Logging Examples](#java-logging-examples)
- [JavaScript/TypeScript Logging Examples](#javascripttypescript-logging-examples)
- [Python Logging Examples](#python-logging-examples)

---

## Java Logging Examples

### ❌ BAD - Logging Sensitive Data (Java)

```java
// DON'T: Logging PII
logger.info("Processing payment for user: {} {}, email: {}", 
    user.getFirstName(), user.getLastName(), user.getEmail());
logger.warn("SMS failed for phone: {}", user.getPhoneNumber());
logger.info("Address: {}", user.getAddress());

// DON'T: Logging financial data
logger.info("Salary: {}", employee.getSalary());
logger.info("Bank account: {}", user.getBankAccountNumber());
logger.info("Credit card: {}", payment.getCreditCardNumber());

// DON'T: Logging tokens and secrets
logger.info("Processing request with token: {}", authToken);
logger.debug("API key: {}", apiKey);
logger.error("Auth failed with token: {}", token, exception);

// DON'T: Logging full objects or headers
logger.info("User details: {}", userObject.toString());
logger.debug("Request headers: {}", request.getHeaders());
```

### ✅ GOOD - Safe Logging (Java)

```java
// DO: Use only user IDs
logger.info("Processing payment for userId: {}", user.getId());

// DO: Mask PII when absolutely necessary
logger.info("Verification email sent, userId: {}, email: {}", 
    user.getId(), maskEmail(user.getEmail()));
// Result: userId: 123, email: ro*****i@papayaglobal.com

logger.warn("SMS failed, userId: {}, phone: {}", 
    user.getId(), maskPhone(user.getPhoneNumber()));
// Result: userId: 123, phone: +972-***********

// DO: Mask financial data (show last 4 digits only)
logger.info("Bank account verified, userId: {}, accountNumber: {}", 
    user.getId(), maskBankAccount(user.getBankAccountNumber()));
// Result: userId: 123, accountNumber: ************5678

logger.info("Payment method added, userId: {}, cardNumber: {}", 
    user.getId(), maskCreditCard(payment.getCreditCardNumber()));
// Result: userId: 123, cardNumber: ****-****-****-9012

// DO: Log only token metadata, never the value
logger.info("Processing request, tokenType: Bearer, userId: {}", userId);
logger.debug("Token prefix: {}, userId: {}", tokenPrefix(authToken), userId);

// DO: Filter sensitive headers
logger.debug("Request headers: {}", filterSensitiveHeaders(headers));
```

### Utility Methods (Java)

```java
private String maskEmail(String email) {
    if (email == null || !email.contains("@")) return "***Redacted***";
    String[] parts = email.split("@");
    String local = parts[0];
    if (local.length() <= 2) return "***@" + parts[1];
    return local.charAt(0) + "*****" + local.charAt(local.length()-1) + "@" + parts[1];
}

private String maskPhone(String phone) {
    if (phone == null) return "***Redacted***";
    return phone.substring(0, Math.min(4, phone.length())) + "-***********";
}

private String maskBankAccount(String accountNumber) {
    if (accountNumber == null || accountNumber.length() < 4) return "***Redacted***";
    return "*".repeat(accountNumber.length() - 4) + accountNumber.substring(accountNumber.length() - 4);
}

private String maskCreditCard(String cardNumber) {
    if (cardNumber == null || cardNumber.length() < 4) return "***Redacted***";
    String cleaned = cardNumber.replaceAll("[\\s-]", "");
    if (cleaned.length() < 4) return "***Redacted***";
    return "****-****-****-" + cleaned.substring(cleaned.length() - 4);
}

private String tokenPrefix(String token) {
    if (token == null || token.length() < 4) return "***";
    return token.substring(0, 4) + "...";
}

private Map<String, String> filterSensitiveHeaders(Map<String, String> headers) {
    Map<String, String> filtered = new HashMap<>(headers);
    filtered.remove("Authorization");
    filtered.remove("X-API-Key");
    filtered.remove("Cookie");
    filtered.remove("X-Auth-Token");
    return filtered;
}
```

### ❌ BAD - Wrong Log Levels (Java)

```java
// DON'T: Using ERROR for expected scenarios
try {
    worker = findWorker(workerId);
} catch (WorkerNotFoundException e) {
    logger.error("Worker not found: {}", workerId); // Should be WARN
}

// DON'T: Logging the same info multiple times
logger.info("Starting payment for userId: {}", userId);
logger.info("Validating payment for userId: {}", userId);
validatePayment(userId);
logger.info("Processing payment for userId: {}", userId);
processPayment(userId);
logger.info("Completed payment for userId: {}", userId);
```

### ✅ GOOD - Correct Log Levels (Java)

```java
// DO: Use WARNING for expected but undesired situations
try {
    worker = findWorker(workerId);
} catch (WorkerNotFoundException e) {
    logger.warn("Worker not found during sync, workerId: {}", workerId);
}

// DO: Use ERROR for critical issues with context
try {
    processPayment(payment);
} catch (PaymentException e) {
    logger.error("Payment processing failed, userId: {}, transactionId: {}", 
        userId, transactionId, e);
}

// DO: Log at entry and critical decision points only
logger.info("Payment processing started, userId: {}, transactionId: {}", 
    userId, transactionId);
try {
    validatePayment(userId);
    processPayment(userId);
    logger.info("Payment completed, transactionId: {}", transactionId);
} catch (ValidationException e) {
    logger.warn("Payment validation failed, userId: {}, reason: {}", 
        userId, e.getMessage());
} catch (PaymentException e) {
    logger.error("Payment processing failed, transactionId: {}, userId: {}", 
        transactionId, userId, e);
}
```

---

## JavaScript/TypeScript Logging Examples

### ❌ BAD - Logging Sensitive Data (JavaScript)

```javascript
// DON'T: Logging PII
logger.info(`Processing payment for ${user.firstName} ${user.lastName}, email: ${user.email}`);
logger.warn(`SMS failed for phone: ${user.phoneNumber}`);
logger.info(`Address: ${user.address}`);

// DON'T: Logging financial data
logger.info(`Salary: ${employee.salary}`);
logger.info(`Bank account: ${user.bankAccountNumber}`);
logger.info(`Credit card: ${payment.creditCardNumber}`);

// DON'T: Logging tokens and secrets
logger.info(`Processing request with token: ${authToken}`);
logger.debug('API key:', apiKey);
logger.error(`Auth failed with token: ${token}`, err);

// DON'T: Logging full objects or headers
logger.info('User details:', JSON.stringify(userObject));
logger.debug('Request headers:', req.headers);

// DON'T: Using console.log in production code
console.log('Processing user:', userId);
console.log('User data:', user); // Never in production React code
```

### ✅ GOOD - Safe Logging (JavaScript)

```javascript
// DO: Use only user IDs
logger.info(`Processing payment for userId: ${user.id}`);

// DO: Mask PII when absolutely necessary
logger.info('Verification email sent', {
    userId: user.id,
    email: maskEmail(user.email)
});
// Result: { userId: 123, email: 'ro*****i@papayaglobal.com' }

logger.warn('SMS failed', {
    userId: user.id,
    phone: maskPhone(user.phoneNumber)
});
// Result: { userId: 123, phone: '+972-***********' }

// DO: Mask financial data (show last 4 digits only)
logger.info('Bank account verified', {
    userId: user.id,
    accountNumber: maskBankAccount(user.bankAccountNumber)
});
// Result: { userId: 123, accountNumber: '************5678' }

logger.info('Payment method added', {
    userId: user.id,
    cardNumber: maskCreditCard(payment.creditCardNumber)
});
// Result: { userId: 123, cardNumber: '****-****-****-9012' }

// DO: Log only token metadata, never the value
logger.info('Processing request', { 
    tokenType: 'Bearer', 
    userId 
});

// DO: Filter sensitive headers
logger.debug('Request headers:', filterSensitiveHeaders(req.headers));

// DO: Use proper logging library, not console.log
import logger from './logger'; // Winston, Pino, etc.
logger.info('Processing payment', { userId, transactionId });

// DO: Conditional logging in frontend (if necessary)
if (process.env.NODE_ENV === 'development') {
    console.log('Debug: Component props', props);
}
```

### Utility Functions (JavaScript)

```javascript
function maskEmail(email) {
    if (!email || !email.includes('@')) return '***Redacted***';
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `***@${domain}`;
    return `${local[0]}*****${local[local.length-1]}@${domain}`;
}

function maskPhone(phone) {
    if (!phone) return '***Redacted***';
    return phone.substring(0, Math.min(4, phone.length)) + '-***********';
}

function maskBankAccount(accountNumber) {
    if (!accountNumber || accountNumber.length < 4) return '***Redacted***';
    return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
}

function maskCreditCard(cardNumber) {
    if (!cardNumber || cardNumber.length < 4) return '***Redacted***';
    const cleaned = cardNumber.replace(/[\s-]/g, '');
    if (cleaned.length < 4) return '***Redacted***';
    return `****-****-****-${cleaned.slice(-4)}`;
}

function tokenPrefix(token) {
    if (!token || token.length < 4) return '***';
    return token.substring(0, 4) + '...';
}

function filterSensitiveHeaders(headers) {
    const filtered = { ...headers };
    delete filtered.authorization;
    delete filtered['x-api-key'];
    delete filtered.cookie;
    delete filtered['x-auth-token'];
    return filtered;
}
```

### ❌ BAD - Wrong Log Levels (JavaScript)

```javascript
// DON'T: Using error level for expected scenarios
try {
    const worker = await findWorker(workerId);
} catch (err) {
    logger.error(`Worker not found: ${workerId}`); // Should be warn
}

// DON'T: Dumping entire request/response objects
logger.info('API request:', req.body);
logger.info('API response:', JSON.stringify(response));
```

### ✅ GOOD - Correct Log Levels (JavaScript)

```javascript
// DO: Use warn for expected but undesired situations
try {
    const worker = await findWorker(workerId);
} catch (err) {
    logger.warn(`Worker not found during sync, workerId: ${workerId}`);
}

// DO: Use error for critical issues with context
try {
    await processPayment(payment);
} catch (err) {
    logger.error('Payment processing failed', { 
        userId, 
        transactionId, 
        error: err.message 
    });
}

// DO: Log only relevant fields
logger.info('Processing request', { 
    requestId: req.id, 
    type: req.body.type 
});
```

---

## Python Logging Examples

### ❌ BAD - Logging Sensitive Data (Python)

```python
# DON'T: Logging PII
logger.info(f"Processing payment for {user.first_name} {user.last_name}, email: {user.email}")
logger.warning(f"SMS failed for phone: {user.phone_number}")
logger.info(f"Address: {user.address}")

# DON'T: Logging financial data
logger.info(f"Salary: {employee.salary}")
logger.info(f"Bank account: {user.bank_account_number}")
logger.info(f"Credit card: {payment.credit_card_number}")

# DON'T: Logging tokens and secrets
logger.info(f"Processing request with token: {auth_token}")
logger.debug(f"API key: {api_key}")
logger.error(f"Auth failed with token: {token}", exc_info=True)

# DON'T: Logging full objects or headers
logger.info(f"User details: {user.__dict__}")
logger.debug(f"Request headers: {request.headers}")

# DON'T: Using print() instead of logger
print(f"Processing user: {user_id}")
print(f"Error: {error}")
```

### ✅ GOOD - Safe Logging (Python)

```python
# DO: Use only user IDs
logger.info(f"Processing payment for userId: {user.id}")

# DO: Mask PII when absolutely necessary
logger.info(f"Verification email sent, userId: {user.id}, email: {mask_email(user.email)}")
# Result: userId: 123, email: ro*****i@papayaglobal.com

logger.warning(f"SMS failed, userId: {user.id}, phone: {mask_phone(user.phone_number)}")
# Result: userId: 123, phone: +972-***********

# DO: Mask financial data (show last 4 digits only)
logger.info(f"Bank account verified, userId: {user.id}, accountNumber: {mask_bank_account(user.bank_account_number)}")
# Result: userId: 123, accountNumber: ************5678

logger.info(f"Payment method added, userId: {user.id}, cardNumber: {mask_credit_card(payment.credit_card_number)}")
# Result: userId: 123, cardNumber: ****-****-****-9012

# DO: Log only token metadata, never the value
logger.info(f"Processing request, tokenType: Bearer, userId: {user_id}")

# DO: Use structured logging with masked PII
logger.info("User verification", extra={
    "user_id": user.id,
    "email_masked": mask_email(user.email),
    "token_prefix": token_prefix(auth_token)
})

# DO: Use proper logging module
import logging
logger = logging.getLogger(__name__)
```

### Utility Functions (Python)

```python
def mask_email(email: str) -> str:
    if not email or '@' not in email:
        return '***Redacted***'
    local, domain = email.split('@')
    if len(local) <= 2:
        return f'***@{domain}'
    return f'{local[0]}*****{local[-1]}@{domain}'

def mask_phone(phone: str) -> str:
    if not phone:
        return '***Redacted***'
    country_code = phone[:min(4, len(phone))]
    return f'{country_code}-***********'

def mask_bank_account(account_number: str) -> str:
    if not account_number or len(account_number) < 4:
        return '***Redacted***'
    return '*' * (len(account_number) - 4) + account_number[-4:]

def mask_credit_card(card_number: str) -> str:
    if not card_number or len(card_number) < 4:
        return '***Redacted***'
    cleaned = card_number.replace(' ', '').replace('-', '')
    if len(cleaned) < 4:
        return '***Redacted***'
    return f'****-****-****-{cleaned[-4:]}'

def token_prefix(token: str) -> str:
    if not token or len(token) < 4:
        return '***'
    return token[:4] + '...'

def filter_sensitive_headers(headers: dict) -> dict:
    filtered = dict(headers)
    sensitive_keys = ['authorization', 'x-api-key', 'cookie', 'x-auth-token']
    for key in sensitive_keys:
        filtered.pop(key, None)
        filtered.pop(key.lower(), None)
    return filtered
```

### ❌ BAD - Wrong Log Levels (Python)

```python
# DON'T: Using error level for expected scenarios
try:
    worker = find_worker(worker_id)
except WorkerNotFoundException as e:
    logger.error(f"Worker not found: {worker_id}")  # Should be warning

# DON'T: Dumping entire dictionaries or objects
logger.info(f"Processing request: {vars(request)}")
logger.info(f"API response: {response.__dict__}")
```

### ✅ GOOD - Correct Log Levels (Python)

```python
# DO: Use warning for expected but undesired situations
try:
    worker = find_worker(worker_id)
except WorkerNotFoundException as e:
    logger.warning(f"Worker not found during sync, workerId: {worker_id}")

# DO: Use error for critical issues with context
try:
    process_payment(payment)
except PaymentException as e:
    logger.error(
        f"Payment processing failed, userId: {user_id}, transactionId: {transaction_id}",
        exc_info=True  # Includes stack trace
    )

# DO: Log only relevant fields
logger.info(f"Processing request, requestId: {request.id}, type: {request.type}")

# DO: Use appropriate log levels
logger.debug("Detailed debug info")  # Only in development
logger.info("Normal flow information")
logger.warning("Expected but undesired situation")
logger.error("Critical issue requiring attention")
```
