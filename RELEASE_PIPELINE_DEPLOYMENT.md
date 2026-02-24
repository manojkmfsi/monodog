# Release Pipeline Manager - Deployment Checklist

## Pre-Deployment

### Code Review
- [ ] All TypeScript compiles without errors
- [ ] No linting errors: `npm run lint`
- [ ] Tests pass: `npm run test`
- [ ] Type checking passes: `npm run type-check`

### Dependencies
- [ ] All new packages are compatible with Node.js 18+
- [ ] No security vulnerabilities: `npm audit`
- [ ] Lock files updated: `pnpm-lock.yaml`

### Configuration
- [ ] GitHub OAuth token configured
- [ ] Database URL set correctly
- [ ] API base URL configured for dashboard
- [ ] All environment variables documented

## Database

### Schema
- [ ] Prisma schema validates without errors: `npx prisma validate`
- [ ] Migration created: `npx prisma migrate dev --name init_github_actions`
- [ ] Schema format is correct: `npx prisma format`

### Migration
- [ ] Test migration on development database
- [ ] Backup production database before migration
- [ ] Run migration: `npm run migrate`
- [ ] Verify tables created: Check database directly
- [ ] Verify indexes created for performance

### Data
- [ ] No data loss expected from schema changes
- [ ] Existing audit logs preserved
- [ ] User permissions unchanged

## Backend

### API Routes
- [ ] All pipeline routes registered in main app
- [ ] Authentication middleware applied
- [ ] Error handling in place
- [ ] Rate limiting configured

### Services
- [ ] GitHub Actions service handles errors gracefully
- [ ] Pipeline service transactions work correctly
- [ ] Audit logging functional
- [ ] Database connection pooling configured

### Testing
- [ ] Workflow fetch endpoint works
- [ ] Job fetch endpoint works
- [ ] Log fetch endpoint works
- [ ] Trigger endpoint accepted POST
- [ ] Cancel endpoint works
- [ ] Rerun endpoint works
- [ ] Audit log endpoint returns data
- [ ] Rate limit endpoint returns correct info

## Frontend

### Components
- [ ] LogViewer renders correctly
- [ ] ANSI codes parse properly
- [ ] Step expand/collapse works
- [ ] WorkflowRunsList updates in real-time
- [ ] WorkflowTrigger modal appears and functions
- [ ] PipelineManager grid layout responsive

### Routes
- [ ] Route registered in `routes.config.ts`
- [ ] Component mapping added to `AppRouter.tsx`
- [ ] Page export added to `pages/index.ts`
- [ ] Navigation item added to `Layout.tsx`

### Styling
- [ ] CSS file imported correctly
- [ ] Log viewer dark theme displays well
- [ ] Status colors visible
- [ ] Responsive on mobile

### Testing
- [ ] Dashboard loads without errors
- [ ] Navigate to /pipeline works
- [ ] Pipeline list displays
- [ ] Clicking pipeline selects it
- [ ] Runs list updates
- [ ] Job logs display
- [ ] ANSI colors render correctly
- [ ] Trigger button opens modal
- [ ] Modal accepts input and submits

## Integration

### OAuth
- [ ] GitHub token available in requests
- [ ] User context passed to routes
- [ ] Permissions validated

### Database
- [ ] Prisma client initialized
- [ ] Connection pool configured
- [ ] Query timeout set appropriately

### Error Handling
- [ ] API errors return proper HTTP codes
- [ ] User-friendly error messages
- [ ] Error logging to console/file
- [ ] Rate limit errors handled gracefully
- [ ] Network errors show fallback UI

## Performance

### Optimization
- [ ] Database queries use indexes
- [ ] API responses paginated
- [ ] No N+1 queries
- [ ] Components memoized appropriately
- [ ] Large logs handled efficiently

### Monitoring
- [ ] Slow queries logged
- [ ] API response times monitored
- [ ] Database connection pooling working
- [ ] Memory usage stable

### Rate Limits
- [ ] GitHub API rate limits respected
- [ ] Polling intervals appropriate
- [ ] No request storms
- [ ] Cache headers set correctly

## Security

### Authentication
- [ ] OAuth tokens stored securely
- [ ] No tokens in logs
- [ ] HTTPS enforced in production
- [ ] Session tokens validated

### Authorization
- [ ] User permissions checked
- [ ] Action-based access control
- [ ] Audit logs created for all actions
- [ ] No privilege escalation possible

### Input Validation
- [ ] Branch names validated
- [ ] Input parameters sanitized
- [ ] SQL injection prevention
- [ ] XSS prevention (React escaping)

### Data Protection
- [ ] Sensitive data not exposed in API
- [ ] Logs redacted if needed
- [ ] User data privacy respected
- [ ] GDPR compliance (if applicable)

## Documentation

### Code
- [ ] TypeScript interfaces documented
- [ ] Function JSDoc comments complete
- [ ] Complex logic commented
- [ ] Edge cases documented

### Setup
- [ ] Installation instructions complete
- [ ] Configuration examples provided
- [ ] Environment variables documented
- [ ] Database setup documented

### API
- [ ] All endpoints documented
- [ ] Request/response formats shown
- [ ] Error codes explained
- [ ] Rate limit info included

### Troubleshooting
- [ ] Common issues listed
- [ ] Solutions provided
- [ ] Debug tips included
- [ ] Support contacts listed

## Deployment Steps

### Staging

1. **Backup**
   ```bash
   # Backup database
   cp ./monodog.db ./monodog.db.backup
   ```

2. **Install**
   ```bash
   # Install dependencies
   npm install
   pnpm install
   ```

3. **Build**
   ```bash
   # Build application
   npm run build
   ```

4. **Database**
   ```bash
   # Run migrations
   npm run migrate
   ```

5. **Test**
   ```bash
   # Run all tests
   npm run test
   ```

6. **Deploy**
   ```bash
   # Start application
   npm run serve
   ```

### Production

1. **Stop Services**
   ```bash
   # Stop current MonoDog service
   systemctl stop monodog
   ```

2. **Backup Database**
   ```bash
   # Full backup before migration
   cp ./monodog.db ./monodog.db.$(date +%s)
   ```

3. **Deploy Code**
   ```bash
   # Pull latest code
   git pull origin main
   
   # Install dependencies
   pnpm install
   
   # Build
   npm run build
   ```

4. **Run Migration**
   ```bash
   # Execute database migration
   npm run migrate
   
   # Verify migration succeeded
   # Check database for new tables
   ```

5. **Start Services**
   ```bash
   # Start MonoDog service
   systemctl start monodog
   
   # Verify service is running
   systemctl status monodog
   ```

6. **Smoke Test**
   ```bash
   # Test critical endpoints
   curl http://localhost:8999/api/pipelines
   curl http://localhost:8999/api/rate-limit
   ```

### Rollback Plan

If issues occur:

1. **Stop Service**
   ```bash
   systemctl stop monodog
   ```

2. **Restore Database**
   ```bash
   # Restore from backup
   cp ./monodog.db.BACKUP ./monodog.db
   ```

3. **Revert Code**
   ```bash
   # Go back to previous version
   git checkout previous-tag
   
   # Rebuild
   npm run build
   ```

4. **Restart**
   ```bash
   systemctl start monodog
   ```

## Post-Deployment

### Verification
- [ ] All services running
- [ ] Database migrations applied
- [ ] API endpoints responding
- [ ] Dashboard loading
- [ ] Logs streaming correctly
- [ ] Audit logs being created

### Monitoring
- [ ] Error rates normal
- [ ] API response times acceptable
- [ ] Database performance good
- [ ] No memory leaks
- [ ] Rate limits not exceeded

### User Communication
- [ ] Release notes published
- [ ] Team notified
- [ ] Documentation updated
- [ ] Support team briefed

## Maintenance

### Regular Tasks
- [ ] Review error logs weekly
- [ ] Check API rate limit usage
- [ ] Monitor database size
- [ ] Clean up old pipelines (every 90 days)
- [ ] Update dependencies monthly

### Monitoring
- [ ] Set up alerts for:
  - API errors (>1% error rate)
  - Database connection failures
  - Rate limit warnings
  - Slow queries (>1s)

### Backups
- [ ] Daily database backups
- [ ] Weekly full backups
- [ ] Test restore procedures monthly
- [ ] Archive old backups securely

## Sign-Off

- [ ] Product Owner Approval
- [ ] Security Review Complete
- [ ] Performance Review Complete
- [ ] Documentation Complete
- [ ] Team Lead Approval
- [ ] DevOps Approval

**Deployed By**: _________________  
**Date**: _________________  
**Version**: _________________  
**Notes**: _________________

---

For questions or issues, contact the development team.
