/**
 * API Response Type Definitions
 * Provides type safety for all API responses across the dashboard
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message: string; status?: number; code?: string };
}

export interface Package {
  name: string;
  version: string;
  path: string;
}

export interface Workflow {
  id: string | number;
  path: string;
  name?: string;
}

export interface WorkflowRunResponse {
  workflow_runs?: any[];
  runs?: any[];
}

export interface JobsResponse {
  jobs?: any[];
}

export interface LogsResponse {
  logs?: string[];
  meta?: { isEmpty: boolean };
}

export interface ChangesetResponse {
  changesets?: any[];
}

export interface ValidationResponse {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  checks?: any;
}

export interface PackagesApiResponse extends ApiResponse<{ packages: Package[] }> {}
export interface AnalysisApiResponse extends ApiResponse<{ analysis: Record<string, any> }> {}
export interface ReadinessApiResponse extends ApiResponse<{ checks: any[] }> {}
export interface PublishApiResponse extends ApiResponse<{ pipelineId: string }> {}
