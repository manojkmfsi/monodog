# Quick Testing Guide - Release Pipeline Manager

## Build & Verify

### 1. Build the Dashboard
```bash
cd /home/manoj/Documents/mjdog/packages/monoapp/monodog-dashboard
npm run build
```
**Expected**: ✅ Build succeeds with 0 errors

### 2. Preview the Build
```bash
npm run preview
```
**Expected**: Dashboard loads at `http://localhost:4173`

### 3. Development Mode
```bash
npm run dev
```
**Expected**: Dev server runs at `http://localhost:5173` with hot reload

## Navigate to Pipeline Page

1. Open the application (dev or preview)
2. Look for "Release Pipeline" in the sidebar with 🚀 icon
3. Click to navigate to `/pipeline`

## Features to Test

### Pipeline Manager Interface
- [ ] Four-column layout visible (Pipelines → Runs → Jobs → Logs)
- [ ] Pipelines list shows available releases
- [ ] Can select a pipeline
- [ ] Runs list updates when pipeline is selected
- [ ] Can select a run
- [ ] Jobs list updates when run is selected
- [ ] Can select a job
- [ ] Log viewer displays job logs with formatting

### Real-time Updates
- [ ] Logs update every 3-5 seconds during job execution
- [ ] Status icons change appropriately (✅ success, ❌ failed, etc.)
- [ ] Run list updates with new runs

### Workflow Trigger
- [ ] Trigger button visible next to pipeline name
- [ ] Click opens modal
- [ ] Can select branch
- [ ] Can add custom inputs
- [ ] Submit button triggers workflow

### UI/UX
- [ ] Colors match CIIntegration page (blues, greens, reds)
- [ ] Hover effects work on buttons
- [ ] Selection highlighting works
- [ ] Responsive layout on different screen sizes
- [ ] Error messages display clearly
- [ ] Loading states show spinner

## Component Files Created

### Frontend
- ✅ [src/components/pipeline/PipelineManager.tsx](src/components/pipeline/PipelineManager.tsx) (400 lines)
- ✅ [src/components/pipeline/LogViewer.tsx](src/components/pipeline/LogViewer.tsx) (400 lines)
- ✅ [src/components/pipeline/WorkflowRunsList.tsx](src/components/pipeline/WorkflowRunsList.tsx) (150 lines)
- ✅ [src/components/pipeline/WorkflowTrigger.tsx](src/components/pipeline/WorkflowTrigger.tsx) (150 lines)
- ✅ [src/pages/PipelinePage.tsx](src/pages/PipelinePage.tsx) (30 lines)

### Backend Services
- ✅ [src/services/github-actions-service.ts](src/services/github-actions-service.ts) (500 lines)
- ✅ [src/services/pipeline-service.ts](src/services/pipeline-service.ts) (350 lines)
- ✅ [src/routes/pipeline-routes.ts](src/routes/pipeline-routes.ts) (400 lines)
- ✅ [src/types/github-actions.ts](src/types/github-actions.ts) (400 lines)

### Database
- ✅ [prisma/schema/github-actions.prisma](prisma/schema/github-actions.prisma) (190 lines)

### Configuration
- ✅ Updated [src/routes/routes.config.ts](src/routes/routes.config.ts) - Added /pipeline route
- ✅ Updated [src/routes/AppRouter.tsx](src/routes/AppRouter.tsx) - Added Pipeline component
- ✅ Updated [src/pages/index.ts](src/pages/index.ts) - Added exports

### Icons
- ✅ Added ExclamationCircleIcon to [src/icons/index.tsx](src/icons/index.tsx)
- ✅ Updated imports in all pipeline components

## Build Results

### Dashboard Build Output
```
✓ 157 modules transformed
✓ dist/index.html                   0.52 kB
✓ dist/assets/index-CPqsPupc.css   59.34 kB │ gzip:  9.10 kB
✓ dist/assets/index-D_j4M65g.js   449.16 kB │ gzip: 111.34 kB
✓ built in 1.41s
```

## API Endpoints Available

All endpoints require authentication and GitHub token:

```
GET  /api/pipelines                          - List all pipelines
GET  /api/pipelines/:id                      - Get pipeline details
GET  /api/pipelines/:id/runs                 - Get workflow runs
GET  /api/pipelines/:id/runs/:runId/jobs     - Get job details
GET  /api/jobs/:jobId/logs                   - Get job logs
POST /api/workflows/:id/trigger              - Trigger workflow
POST /api/workflows/:id/dispatch             - Dispatch with inputs
GET  /api/audit-logs                         - Get audit logs
GET  /api/metrics                            - Get metrics
GET  /api/rate-limit                         - Get GitHub rate limit
```

## TypeScript Types

All components and services use strict TypeScript types:

```typescript
// From src/types/github-actions.ts
export interface Pipeline { ... }
export interface WorkflowRun { ... }
export interface Job { ... }
export interface StepLog { ... }
export interface GitHubActionResponse { ... }
```

## Environment Variables Required

Pipeline manager uses existing MonoDog environment:
- `GITHUB_TOKEN` - GitHub Personal Access Token
- `GITHUB_OWNER` - Repository owner
- `GITHUB_REPO` - Repository name

These are loaded from your auth session via OAuth.

## Troubleshooting

### Build Fails
- Clear cache: `rm -rf dist node_modules/.vite`
- Reinstall: `npm install`
- Rebuild: `npm run build`

### Pipeline Page Shows "Not Found"
- Check route configuration in routes.config.ts
- Verify PipelinePage.tsx is exported from src/pages/index.ts
- Ensure AppRouter has Pipeline in componentMap

### Icons Missing
- Check that all icon imports use `../../icons/index`
- Verify ExclamationCircleIcon is exported from src/icons/index.tsx

### API Fails
- Verify GitHub token is valid
- Check rate limits: `GET /api/rate-limit`
- Review audit logs for failures
- Check browser console for detailed errors

## Performance Tips

- Logs load on demand (not all at once)
- Real-time updates use efficient polling
- ANSI parsing is cached
- Grid layout uses CSS Grid for performance
- No unnecessary re-renders with React hooks

## Success Indicators ✅

1. Dashboard builds without errors
2. Navigation shows "Release Pipeline" with 🚀 icon
3. Can navigate to `/pipeline` route
4. Pipeline list loads data from GitHub
5. Can select pipelines and view runs
6. Can view job logs with colors
7. Workflow trigger modal works
8. Updates happen in real-time (3-5s)
9. UI matches CIIntegration page styling
10. No console errors

---

**Status**: Ready for Testing ✅
