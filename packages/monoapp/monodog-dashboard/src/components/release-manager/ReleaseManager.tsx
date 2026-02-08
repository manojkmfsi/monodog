/**
 * Release Manager Component
 * 
 * Comprehensive UI-driven version control and package publishing for monorepos using Changesets.
 * Allows users to:
 * - Select packages and version bumps
 * - Generate changesets
 * - Preview releases
 * - Trigger publishing pipeline
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../services/auth-context';
import PackageSelector from './components/PackageSelector';
import VersionBumpSelector from './components/VersionBumpSelector';
import ChangesetPreview from './components/ChangesetPreview';
import ReleaseValidation from './components/ReleaseValidation';
import PublishConfirmation from './components/PublishConfirmation';
import LoadingState from './components/LoadingState';
import ErrorState from './components/ErrorState';
import '../../styles/release-manager.css';

export interface SelectedPackage {
  name: string;
  currentVersion: string;
  newVersion: string;
  bumpType: 'major' | 'minor' | 'patch';
  affectedDependencies: string[];
}

export interface ChangesetData {
  packages: SelectedPackage[];
  summary: string;
  timestamp: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  checks: {
    permissions: boolean;
    workingTreeClean: boolean;
    ciPassing: boolean;
    versionAvailable: boolean;
  };
}

export default function ReleaseManager() {
  const { isAuthenticated, hasPermission } = useAuth();
  const [currentStep, setCurrentStep] = useState<'select' | 'bump' | 'preview' | 'validate' | 'confirm'>('select');
  const [selectedPackages, setSelectedPackages] = useState<SelectedPackage[]>([]);
  const [changesetSummary, setChangesetSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [allPackages, setAllPackages] = useState<any[]>([]);
  const [existingChangesets, setExistingChangesets] = useState<any[]>([]);

  // Fetch workspace packages on mount
  useEffect(() => {
    fetchWorkspaceData();
  }, []);

  const fetchWorkspaceData = async () => {
    try {
      setLoading(true);
      const apiUrl = (window as any).ENV?.API_URL ?? 'http://localhost:8999';
      const API_BASE = `${apiUrl}/api`;
      
      // Get auth token from localStorage
      const token = localStorage.getItem('monodog_session_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      };

      // Fetch packages
      const packagesRes = await fetch(`${API_BASE}/publish/packages`, {
        headers,
      });
      if (packagesRes.ok) {
        const packagesData = await packagesRes.json();
        setAllPackages(packagesData.packages || []);
      } else {
        console.warn('Failed to fetch packages:', packagesRes.status);
        // Fallback to regular packages endpoint
        const fallbackRes = await fetch(`${API_BASE}/packages`, { headers });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          setAllPackages(fallbackData || []);
        }
      }

      // Fetch existing changesets
      const changesetsRes = await fetch(`${API_BASE}/publish/changesets`, {
        headers,
      });
      if (changesetsRes.ok) {
        const changesetsData = await changesetsRes.json();
        setExistingChangesets(changesetsData.changesets || []);
      }

      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch workspace data';
      setError(message);
      console.error('Error fetching workspace data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePackagesSelected = (packages: any[]) => {
    const selected: SelectedPackage[] = packages.map(pkg => ({
      name: pkg.name,
      currentVersion: pkg.version,
      newVersion: pkg.version, // Will be updated in bump step
      bumpType: 'patch',
      affectedDependencies: pkg.dependents || [],
    }));
    setSelectedPackages(selected);
    setCurrentStep('bump');
  };

  const handleVersionBumpsConfirmed = (updatedPackages: SelectedPackage[]) => {
    setSelectedPackages(updatedPackages);
    setCurrentStep('preview');
  };

  const handlePreviewConfirmed = (summary: string) => {
    setChangesetSummary(summary);
    validateRelease(selectedPackages, summary);
  };

  const validateRelease = async (packages: SelectedPackage[], summary: string) => {
    try {
      setLoading(true);
      const apiUrl = (window as any).ENV?.API_URL ?? 'http://localhost:8999';
      const API_BASE = `${apiUrl}/api`;
      
      // Get auth token from localStorage
      const token = localStorage.getItem('monodog_session_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      };

      const response = await fetch(`${API_BASE}/publish/preview`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          packages: packages.map(p => p.name),
          bumps: packages.map(p => ({
            package: p.name,
            bumpType: p.bumpType,
          })),
          summary,
        }),
      });

      if (!response.ok) {
        throw new Error('Validation failed');
      }

      const result = await response.json();
      
      // Ensure the result has the expected structure
      const validationData: ValidationResult = {
        isValid: result.isValid ?? true,
        errors: result.errors ?? [],
        warnings: result.warnings ?? [],
        checks: result.checks ?? {
          permissions: true,
          workingTreeClean: true,
          ciPassing: true,
          versionAvailable: true,
        },
      };
      
      setValidationResult(validationData);
      setCurrentStep('validate');
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation error';
      setError(message);
      console.error('Validation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishConfirmed = async () => {
    try {
      setLoading(true);
      const apiUrl = (window as any).ENV?.API_URL ?? 'http://localhost:8999';
      const API_BASE = `${apiUrl}/api`;
      
      // Get auth token from localStorage
      const token = localStorage.getItem('monodog_session_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      };

      // Create changeset
      const changesetRes = await fetch(`${API_BASE}/publish/changesets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          packages: selectedPackages.map(p => p.name),
          bumps: selectedPackages.map(p => ({
            package: p.name,
            bumpType: p.bumpType,
          })),
          summary: changesetSummary,
        }),
      });

      if (!changesetRes.ok) {
        throw new Error('Failed to create changeset');
      }

      // Trigger publish
      const publishRes = await fetch(`${API_BASE}/publish/trigger`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          packages: selectedPackages.map(p => p.name),
        }),
      });

      if (!publishRes.ok) {
        throw new Error('Failed to trigger publish');
      }

      setCurrentStep('confirm');
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Publishing error';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCurrentStep('select');
    setSelectedPackages([]);
    setChangesetSummary('');
    setValidationResult(null);
    setError(null);
    fetchWorkspaceData();
  };

  if (!isAuthenticated) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">Please log in to access release management.</p>
      </div>
    );
  }

  if (loading && currentStep === 'select' && allPackages.length === 0) {
    return <LoadingState message="Loading workspace packages..." />;
  }

  if (error && currentStep === 'select') {
    return <ErrorState error={error} onRetry={fetchWorkspaceData} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Release Manager</h1>
          <p className="text-gray-600 mt-1">
            Manage package versions and publish releases with Changesets
          </p>
        </div>
        <div className="text-sm text-gray-500">
          Step {['select', 'bump', 'preview', 'validate', 'confirm'].indexOf(currentStep) + 1} of 5
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 font-medium">Error</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Existing Changesets Warning */}
      {existingChangesets.length > 0 && currentStep === 'select' && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-700 font-medium">
            {existingChangesets.length} unpublished changeset(s) detected
          </p>
          <p className="text-blue-600 text-sm mt-1">
            Consider reviewing existing changesets before creating new ones
          </p>
        </div>
      )}

      {/* Step Content */}
      {currentStep === 'select' && (
        <PackageSelector
          packages={allPackages}
          onConfirm={handlePackagesSelected}
          loading={loading}
        />
      )}

      {currentStep === 'bump' && (
        <VersionBumpSelector
          packages={selectedPackages}
          onConfirm={handleVersionBumpsConfirmed}
          onBack={() => setCurrentStep('select')}
        />
      )}

      {currentStep === 'preview' && (
        <ChangesetPreview
          packages={selectedPackages}
          existingChangesets={existingChangesets}
          onConfirm={handlePreviewConfirmed}
          onBack={() => setCurrentStep('bump')}
          loading={loading}
        />
      )}

      {currentStep === 'validate' && validationResult && (
        <ReleaseValidation
          validation={validationResult}
          packages={selectedPackages}
          onConfirm={handlePublishConfirmed}
          onBack={() => setCurrentStep('preview')}
          loading={loading}
        />
      )}

      {currentStep === 'confirm' && (
        <PublishConfirmation
          packages={selectedPackages}
          summary={changesetSummary}
          onReset={handleReset}
        />
      )}

      {/* Progress Indicator */}
      <div className="flex gap-2 justify-center">
        {['select', 'bump', 'preview', 'validate', 'confirm'].map((step, index) => (
          <div
            key={step}
            className={`h-2 flex-1 rounded-full transition-colors ${
              ['select', 'bump', 'preview', 'validate', 'confirm'].indexOf(currentStep) >= index
                ? 'bg-primary-500'
                : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
