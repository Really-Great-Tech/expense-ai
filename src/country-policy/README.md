# Country Policy Seeding System

This module provides a production-ready, TypeORM migration-based seeding solution for country policy data. It transforms JSON seed files from the `country_seed/` directory into structured database entities with full version control and data validation.

## Features

- **TypeORM Migration-Based**: Uses proper database migrations for seeding (not custom services)
- **Data Validation**: Validates all seed data using class-validator DTOs
- **Version Management**: Supports multiple policy versions per country
- **Idempotent Operations**: Safe to run multiple times without data duplication
- **Transaction Safety**: All operations wrapped in database transactions
- **Production Ready**: Comprehensive error handling, logging, and rollback capabilities
- **API Endpoints**: RESTful API for querying and managing country policies
- **Health Checks**: Built-in data integrity validation

## Architecture

```
src/country-policy/
├── controllers/           # REST API controllers
├── dto/                  # Data Transfer Objects with validation
├── entities/             # TypeORM entities
├── services/             # Business logic services
├── utils/               # Migration and transformation utilities
└── README.md           # This documentation
```

## Database Schema

- **Country**: Core country information with active policy reference
- **Version**: Policy version management (composite key: countryId + versionId)
- **CountryPolicy**: JSON-based policy rules storage
- **Datasource**: Tracking of policy source files and metadata

## Usage

### 1. Production Deployment (Recommended)

Use TypeORM migrations for production seeding:

```bash
# Run all pending migrations (includes country seeding)
npm run migration:run

# Rollback country seeding migration
npm run migration:revert
```

### 2. Development/Testing

Alternative methods for development:

```bash
# API-based seeding (not recommended for production)
POST /country-policies/seed/countries

# Individual country seeding
POST /country-policies/seed/countries/belgium
```

### 3. Data Validation

```bash
# Check data integrity
GET /country-policies/health

# Check seeding status  
GET /country-policies/seed/status
```

## API Endpoints

### Country Management
- `GET /country-policies/countries` - List all countries
- `GET /country-policies/countries/:id` - Get country by ID
- `GET /country-policies/countries/name/:name` - Get country by name
- `GET /country-policies/countries/:id/active-policy` - Get active policy
- `PUT /country-policies/countries/:id/active-policy` - Set active policy

### Version Management
- `GET /country-policies/countries/:id/versions` - List country versions
- `GET /country-policies/countries/:id/versions/:versionId` - Get specific version

### Policy Management
- `GET /country-policies/policies/:id` - Get policy by ID
- `GET /country-policies/countries/:id/datasources` - Get country datasources

### System Health
- `GET /country-policies/health` - Data integrity check
- `GET /country-policies/seed/status` - Seeding status
- `GET /country-policies/seed/available-countries` - Available seed files

### Development/Admin Seeding
- `POST /country-policies/seed/countries` - Seed all countries
- `POST /country-policies/seed/countries/:name` - Seed specific country
- `POST /country-policies/seed/validate` - Validate seeded data

## Data Transformation

### Input Format (JSON Seed Files)
```json
{
  "receiptStandards": [
    {
      "required_data": "Transaction date",
      "travel_non_travel_both": "Both",
      "expense_type": "Hotel",
      "icp_name": "Company Name",
      "mandatory_optional": "Mandatory",
      "rule": "Date must be clearly visible"
    }
  ],
  "compliancePoliciesGrossUpRelated": [...],
  "compliancePoliciesAdditionalInfoRelated": [...]
}
```

### Output Format (Database Entity)
```typescript
{
  receiptStandards: [
    {
      description: "Transaction date",
      travelNonTravelBoth: "Both",
      expenseType: "Hotel", 
      icpName: "Company Name",
      mandatoryOptional: "Mandatory",
      rule: "Date must be clearly visible"
    }
  ],
  compliancePoliciesGrossUpRelated: [...],
  compliancePoliciesAdditionalInfoRelated: [...]
}
```

## Version Management

- **Version IDs**: Auto-generated as `v2024.01.15` (vYYYY.MM.DD format)
- **Active Policies**: Each country has one active policy reference
- **Version History**: All versions are preserved for audit trails
- **Policy Updates**: New versions can be created without affecting existing data

## Error Handling

The system provides comprehensive error handling:

- **Validation Errors**: Invalid seed data is rejected with detailed messages
- **File System Errors**: Missing or corrupted seed files are handled gracefully
- **Database Errors**: Transaction rollback prevents partial data corruption
- **API Errors**: RESTful HTTP status codes with descriptive error messages

## Testing

```bash
# Run unit tests
npm test src/country-policy

# Run specific test files
npm test src/country-policy/utils/data-transformer.spec.ts

# Coverage report
npm run test:cov
```

## Production Considerations

### Deployment Pipeline
1. **Pre-deployment**: Validate all seed files
2. **Migration**: Run `npm run migration:run`
3. **Post-deployment**: Run health checks
4. **Rollback**: Use `npm run migration:revert` if needed

### Monitoring
- Monitor `/country-policies/health` endpoint
- Set up alerts for validation failures
- Track migration execution times

### Data Updates
- New countries: Add JSON file to `country_seed/` and create new migration
- Policy updates: Create new version with updated rules
- Schema changes: Use standard TypeORM migrations

## Troubleshooting

### Common Issues

1. **Migration Fails**
   ```bash
   # Check database connectivity
   npm run typeorm -- query "SELECT 1"
   
   # Validate seed files
   GET /country-policies/seed/available-countries
   ```

2. **Validation Errors**
   ```bash
   # Check specific country file
   POST /country-policies/seed/countries/belgium
   ```

3. **Data Integrity Issues**
   ```bash
   # Run health check
   GET /country-policies/health
   ```

### Recovery

If seeding fails partially:
```bash
# Rollback migration
npm run migration:revert

# Fix issues and re-run
npm run migration:run
```

## Security Considerations

- **Input Validation**: All seed data validated with class-validator
- **SQL Injection**: Protected by TypeORM parameterized queries
- **File Access**: Seed files read from controlled directory only
- **API Authentication**: Integrate with existing auth system as needed

## Performance

- **Batch Operations**: All countries seeded in single transaction
- **Indexing**: Proper database indexes on foreign keys
- **Memory Usage**: Stream processing for large seed files
- **Query Optimization**: Efficient relationship loading

## Contributing

1. Add new seed files to `country_seed/` directory
2. Follow JSON schema format for consistency
3. Run tests before submitting: `npm test src/country-policy`
4. Update this documentation for new features

## Support

For issues or questions:
1. Check health endpoint: `GET /country-policies/health`
2. Review logs for detailed error messages
3. Validate seed file format against DTOs
4. Use rollback capabilities for recovery
