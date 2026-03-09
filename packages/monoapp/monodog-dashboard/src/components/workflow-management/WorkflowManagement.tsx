import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';

interface WorkflowInput {
  packages?: {
    description: string;
    required: boolean;
    default: string;
  };
}

interface WorkflowStep {
  name: string;
  uses?: string;
  run?: string;
  'working-directory'?: string;
  with?: Record<string, any>;
  if?: string;
}

interface WorkflowJob {
  'runs-on': string;
  steps: WorkflowStep[];
}

interface WorkflowConfig {
  name: string;
  on?: {
    workflow_dispatch?: {
      inputs?: WorkflowInput;
    };
  };
  jobs?: {
    release?: WorkflowJob;
  };
}

export default function WorkflowManagement({
  preselectedPackages = [],
}: {
  preselectedPackages?: string[];
}) {
  const [workflowExists, setWorkflowExists] = useState(false);
  const [selectedPackages, setSelectedPackages] =
    useState<string[]>(preselectedPackages);
  const [workflow, setWorkflow] = useState<WorkflowConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [availablePackages, setAvailablePackages] = useState<string[]>([]);

  // Check if workflow exists on mount
  useEffect(() => {
    checkWorkflowExists();
    fetchAvailablePackages();
  }, []);

  // Update selected packages when preselectedPackages prop changes
  useEffect(() => {
    if (preselectedPackages && preselectedPackages.length > 0) {
      setSelectedPackages(preselectedPackages);
    }
  }, [preselectedPackages]);

  // Load selected packages when workflow is loaded
  useEffect(() => {
    if (workflow?.on?.workflow_dispatch?.inputs?.packages?.default) {
      const packages = workflow.on.workflow_dispatch.inputs.packages.default
        .split(',')
        .map(p => p.trim())
        .filter(p => p);
      setSelectedPackages(packages);
    }
  }, [workflow]);

  const checkWorkflowExists = async () => {
    try {
      const response = await apiClient.get('/workflows/check');
      setWorkflowExists(response.data.exists);
      if (response.data.exists) {
        loadWorkflow();
      }
    } catch (err) {
      console.error('Error checking workflow:', err);
      setError('Failed to check workflow status');
    }
  };

  const fetchAvailablePackages = async () => {
    try {
      const response = await apiClient.get('/packages');
      const packages =
        response.data.packages?.map((pkg: any) => pkg.name) || [];
      setAvailablePackages(packages);
    } catch (err) {
      console.error('Error fetching packages:', err);
    }
  };

  const loadWorkflow = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/workflows/read');
      setWorkflow(response.data.workflow);
      setError(null);
    } catch (err) {
      console.error('Error loading workflow:', err);
      setError('Failed to load workflow');
    } finally {
      setLoading(false);
    }
  };

  const createWorkflow = async () => {
    if (selectedPackages.length === 0) {
      setError('Please select at least one package');
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.post('/workflows/create', {
        packageNames: selectedPackages,
      });
      setSuccess('Workflow created successfully!');
      setError(null);
      checkWorkflowExists();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error creating workflow:', err);
      setError('Failed to create workflow');
    } finally {
      setLoading(false);
    }
  };

  const updateSelectedPackages = async () => {
    if (selectedPackages.length === 0) {
      setError('Please select at least one package');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/workflows/update-packages', {
        packageNames: selectedPackages,
      });
      setSuccess('Selected packages updated!');
      setError(null);
      await loadWorkflow();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating packages:', err);
      setError('Failed to update packages');
    } finally {
      setLoading(false);
    }
  };

  const saveWorkflow = async () => {
    if (!workflow) return;

    try {
      setLoading(true);
      await apiClient.post('/workflows/update', { workflow });
      setSuccess('Workflow saved successfully!');
      setError(null);
      setEditing(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving workflow:', err);
      setError('Failed to save workflow');
    } finally {
      setLoading(false);
    }
  };

  const deleteWorkflow = async () => {
    if (!confirm('Are you sure you want to delete the workflow?')) return;

    try {
      setLoading(true);
      await apiClient.delete('/workflows/delete');
      setSuccess('Workflow deleted successfully!');
      setError(null);
      setWorkflow(null);
      setWorkflowExists(false);
      setSelectedPackages([]);
    } catch (err) {
      console.error('Error deleting workflow:', err);
      setError('Failed to delete workflow');
    } finally {
      setLoading(false);
    }
  };

  const handlePackageSelect = (packageName: string) => {
    setSelectedPackages(prev =>
      prev.includes(packageName)
        ? prev.filter(p => p !== packageName)
        : [...prev, packageName]
    );
  };

  const handleDispatchWorkflow = async () => {
    if (selectedPackages.length === 0) {
      setError('Please select at least one package to publish');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.post('/workflows/dispatch', {
        packages: selectedPackages,
      });

      if (response.data.success) {
        setSuccess(
          `✅ Release workflow dispatched! Publishing: ${selectedPackages.join(', ')}`
        );
        setTimeout(() => setSuccess(null), 5000);
      } else {
        setError(response.data.error || 'Failed to dispatch workflow');
      }
    } catch (err) {
      console.error('Error dispatching workflow:', err);
      setError('Failed to dispatch release workflow');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6">Workflow Management</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      {/* Workflow Status */}
      <div className="mb-6 p-4 bg-gray-50 rounded border">
        <h3 className="font-semibold mb-2">Workflow Status</h3>
        <p className="text-sm text-gray-600">
          {workflowExists
            ? '✓ monodog-release.yaml exists'
            : '✗ monodog-release.yaml not found'}
        </p>
      </div>

      {/* Package Selection */}
      <div className="mb-6">
        <h3 className="font-semibold mb-3">Select Packages to Release</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {availablePackages.map(pkg => (
            <label key={pkg} className="flex items-center">
              <input
                type="checkbox"
                checked={selectedPackages.includes(pkg)}
                onChange={() => handlePackageSelect(pkg)}
                className="mr-2"
              />
              <span className="text-sm">{pkg}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Selected:{' '}
          {selectedPackages.length > 0 ? selectedPackages.join(', ') : 'None'}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-6">
        {!workflowExists ? (
          <button
            onClick={createWorkflow}
            disabled={loading || selectedPackages.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Workflow'}
          </button>
        ) : (
          <>
            <button
              onClick={handleDispatchWorkflow}
              disabled={loading || selectedPackages.length === 0}
              className="px-6 py-2 bg-purple-600 text-white rounded font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⚙️</span>
                  Publishing...
                </>
              ) : (
                <>✨ Commit & Publish</>
              )}
            </button>
            <button
              onClick={updateSelectedPackages}
              disabled={loading || selectedPackages.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Packages'}
            </button>
            <button
              onClick={() => setEditing(!editing)}
              className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
            >
              {editing ? 'Cancel Edit' : 'Edit Workflow'}
            </button>
            <button
              onClick={deleteWorkflow}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Deleting...' : 'Delete Workflow'}
            </button>
          </>
        )}
      </div>

      {/* Workflow Editor */}
      {workflowExists && workflow && editing && (
        <div className="mb-6 p-4 bg-gray-50 rounded border">
          <h3 className="font-semibold mb-3">Edit Workflow</h3>
          <textarea
            value={JSON.stringify(workflow, null, 2)}
            onChange={e => {
              try {
                setWorkflow(JSON.parse(e.target.value));
                setError(null);
              } catch {
                // Invalid JSON, don't update state
              }
            }}
            className="w-full h-96 p-3 border rounded font-mono text-sm"
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={saveWorkflow}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Workflow Display */}
      {workflowExists && workflow && !editing && (
        <div className="p-4 bg-gray-50 rounded border">
          <h3 className="font-semibold mb-3">Current Workflow</h3>
          <div className="text-sm space-y-2">
            <p>
              <strong>Name:</strong> {workflow.name}
            </p>
            {selectedPackages.length > 0 && (
              <p>
                <strong>Selected Packages:</strong>{' '}
                {selectedPackages.join(', ')}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-3">
              Location: .github/workflows/monodog-release.yaml
            </p>
          </div>
        </div>
      )}

      {loading && <p className="text-center text-gray-500">Loading...</p>}
    </div>
  );
}
