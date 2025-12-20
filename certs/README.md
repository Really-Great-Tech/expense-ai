# SSL/TLS Certificates for AWS RDS

## global-bundle.pem

This is the AWS RDS Global Certificate Authority (CA) bundle that contains root and intermediate certificates for all AWS regions.

### Purpose
- Required for SSL/TLS connections to Amazon RDS and Aurora databases
- Used for IAM database authentication (which requires SSL)
- Validates the identity of RDS database endpoints

### Source
Downloaded from: https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

### Certificate Details
- Contains 108 certificates covering all AWS regions
- Includes both RSA and ECDSA certificates
- Valid until approximately 2061
- File size: ~162KB

### How It's Obtained

**Docker builds:** The certificate is automatically downloaded at build time via the Dockerfile:
```dockerfile
RUN mkdir -p certs && \
    curl -o certs/global-bundle.pem \
    https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

**Local development:** Download manually if needed:
```bash
mkdir -p certs
curl -o certs/global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

### Note on Git Tracking
The certificate file is NOT tracked in git (ignored via .gitignore). This ensures:
- Always using the latest certificate bundle at build time
- No stale certificates in the repository
- Following best practices for certificate management

### Fallback Behavior
If the certificate file is not present, the application will fall back to system CA certificates. This works in most production environments but may fail for some RDS endpoints.

### Usage in Application
The certificate is automatically loaded by the database configuration when:
- `MYSQL_SSL=true` is set in environment variables
- `MYSQL_IAM_AUTH_ENABLED=true` (IAM auth requires SSL)

See `src/config/database.ts` for implementation details.

### Verification
To verify the certificate bundle is valid:
```bash
openssl x509 -in certs/global-bundle.pem -text -noout | head -30
```

### References
- [AWS RDS SSL/TLS Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html)
- [RDS Certificate Trust Store](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL-certificate-rotation.html)
