/**
 * Release API Service
 * Client for the independent release engine
 * Provides methods to interact with release endpoints
 */

import apiClient from './api';

export interface ReleaseReadinesCheck {
  packageName: string;
  currentVersion: string;
  proposedVersion: string;
  isReady: boolean;
  reasons: string[];
  blockers: string[];
  warnings: string[];
}

export interface PublishPipelineStatus {
  pipelineId: string;
  status: 'pending' | 'validating' | 'ready' | 'publishing' | 'completed' | 'failed';
  progress: number;
  packagesToPublish: string[];
  results: Record<string, any>;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

/**
 * Release API service
 */
export const releaseAPI = {
  /**
   * Get list of available packages
   */
  async getPackages() {
    return apiClient.get('/releases/packages');
  },

  /**
   * Analyze changes for packages
   */
  async analyzeChanges(packageNames: string[], packagePaths: Record<string, string>) {
    return apiClient.post('/releases/analyze', {
      packageNames,
      packagePaths,
    });
  },

  /**
   * Check if packages are ready for release
   */
  async checkReadiness(packageNames: string[], packagePaths: Record<string, string>) {
    return apiClient.post('/releases/check-readiness', {
      packageNames,
      packagePaths,
    });
  },

  /**
   * Prepare packages for publishing (validate and analyze)
   */
  async prepare(packageNames: string[], packagePaths: Record<string, string>, dryRun = false) {
    return apiClient.post('/releases/prepare', {
      packageNames,
      packagePaths,
      dryRun,
    });
  },

  /**
   * Start a new publish pipeline
   */
  async startPublish(
    packageNames: string[],
    packagePaths: Record<string, string>,
    options?: {
      versionMap?: Record<string, string>;
      method?: 'node' | 'github-actions' | 'auto';
      dryRun?: boolean;
      autoTag?: boolean;
      createReleases?: boolean;
    }
  ) {
    return apiClient.post('/releases/start', {
      packageNames,
      packagePaths,
      ...options,
    });
  },

  /**
   * Get pipeline status
   */
  async getPipelineStatus(pipelineId: string) {
    return apiClient.get(`/releases/status/${pipelineId}`);
  },

  /**
   * Get detailed pipeline information
   */
  async getPipelineDetails(pipelineId: string) {
    return apiClient.get(`/releases/details/${pipelineId}`);
  },

  /**
   * Get all pipelines with optional filtering
   */
  async getPipelines(status?: string, limit?: number) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (limit) params.append('limit', String(limit));
    const query = params.toString();
    return apiClient.get(`/releases/pipelines?${query}`);
  },

  /**
   * Cancel a publishing pipeline
   */
  async cancelPipeline(pipelineId: string) {
    return apiClient.post(`/releases/cancel/${pipelineId}`);
  },

  /**
   * Get published versions of a package on npm
   */
  async getPackageVersions(packageName: string) {
    return apiClient.get(`/releases/npm/${packageName}/versions`);
  },

  /**
   * Check if a version is available on npm
   */
  async isVersionAvailable(packageName: string, version: string) {
    return apiClient.get(`/releases/npm/${packageName}/${version}/available`);
  },

  /**
   * Get system health status
   */
  async getHealth() {
    return apiClient.get('/releases/health');
  },
};

export default releaseAPI;
