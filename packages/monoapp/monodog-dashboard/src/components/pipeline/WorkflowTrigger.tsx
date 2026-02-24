import React, { useState, useEffect } from 'react';
import { PlayIcon, ExclamationCircleIcon } from '../../icons/index';

const apiUrl = (window as any).ENV?.API_URL;

interface WorkflowOption {
  id: number;
  name: string;
  path: string;
}

interface WorkflowTriggerProps {
  owner: string;
  repo: string;
  workflowId: string;
  defaultBranch?: string;
  onSuccess?: (runUrl: string) => void;
  onError?: (error: string) => void;
  pipelineId?: string;
}

export default function WorkflowTrigger({
  owner,
  repo,
  workflowId,
  defaultBranch = 'main',
  onSuccess,
  onError,
  pipelineId,
}: WorkflowTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [branch, setBranch] = useState(defaultBranch);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>();
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);

  // Fetch available workflows when modal opens
  useEffect(() => {
    if (isOpen && workflows.length === 0) {
      fetchWorkflows();
    }
  }, [isOpen]);

  const fetchWorkflows = async () => {
    try {
      setLoadingWorkflows(true);
      const token = localStorage.getItem('monodog_session_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      };

      const response = await fetch(
        `${apiUrl}/api/workflows/${owner}/${repo}/available`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        setWorkflows(data.workflows || []);
        // If no workflow path was set, use the first available one
        if (data.workflows?.length > 0 && !selectedWorkflow) {
          setSelectedWorkflow(data.workflows[0].path);
        }
      }
    } catch (err) {
      console.error('Failed to fetch workflows:', err);
    } finally {
      setLoadingWorkflows(false);
    }
  };

  const handleTrigger = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('monodog_session_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      };
      const response = await fetch(
        `${apiUrl}/api/workflows/${owner}/${repo}/trigger`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            workflow: selectedWorkflow,
            ref: branch,
            inputs,
            pipelineId,
            workflowId
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to trigger workflow');
      }

      const data = await response.json();

      if (data.success) {
        onSuccess?.(data.runUrl || `https://github.com/${owner}/${repo}/actions`);
        setIsOpen(false);
        setBranch(defaultBranch);
        setInputs({});
      } else {
        throw new Error(data.message || 'Failed to trigger workflow');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <PlayIcon className="h-4 w-4" />
        Trigger Workflow
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Trigger Workflow
          </h3>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <ExclamationCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Workflow
              </label>
              {loadingWorkflows ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                  Loading workflows...
                </div>
              ) : workflows.length > 0 ? (
                <select
                  value={selectedWorkflow}
                  onChange={(e) => setSelectedWorkflow(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {workflows.map((wf) => (
                    <option key={wf.id} value={wf.path}>
                      {wf.name} ({wf.path})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-yellow-50 text-yellow-700 text-sm">
                  No workflows available
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleTrigger}
                disabled={loading || !branch}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Triggering...' : 'Trigger'}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
