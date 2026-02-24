import React, { useState, useEffect } from 'react';
import { ExclamationCircleIcon, CheckCircleIcon, ClockIcon } from '../../icons/index';
import { useAuth } from '../../services/auth-context';

const apiUrl = (window as any).ENV?.API_URL;

interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  head_branch: string;
  actor: {login: string};
  htmlUrl: string;
}

interface WorkflowRunsListProps {
  owner: string;
  repo: string;
  packageName?: string;
  onSelectRun?: (runId: number) => void;
  runId: number,
  limit?: number;
  pipelineId?: string;
}

function getStatusIcon(status: string, conclusion: string | null) {
  if (status === 'completed') {
    if (conclusion === 'success') {
      return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
    } else if (conclusion === 'failure') {
      return <ExclamationCircleIcon className="h-5 w-5 text-red-600" />;
    }
  }
  return <ClockIcon className="h-5 w-5 text-yellow-600" />;
}

function getStatusBadgeClass(status: string, conclusion: string | null): string {
  if (status === 'completed') {
    if (conclusion === 'success') {
      return 'bg-green-100 text-green-800';
    } else if (conclusion === 'failure') {
      return 'bg-red-100 text-red-800';
    }
  }
  return 'bg-yellow-100 text-yellow-800';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString();
}

export default function WorkflowRunsList({
  owner,
  repo,
  packageName,
  onSelectRun,
  runId,
  limit = 10,
  pipelineId,
}: WorkflowRunsListProps) {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);
  const { isAuthenticated, hasPermission } = useAuth();

  useEffect(() => {
    const fetchRuns = async () => {
      try {
        setLoading(true);
        setError(null);

        let url = `${apiUrl}/api/workflows/${owner}/${repo}?per_page=${limit}`;
        if (packageName) {
          url = `${apiUrl}/api/workflows/package/${owner}/${repo}/${encodeURIComponent(packageName)}`;
        }

        const token = localStorage.getItem('monodog_session_token');
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        };

        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error('Failed to fetch workflow runs');
        }

        const data = await response.json();
        const runsList = packageName
          ? data
              .flatMap((p: any) => p.workflowRuns)
              .slice(0, limit)
          : data.runs;

        setRuns(runsList);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    const interval = setInterval(fetchRuns, 5000); // Poll every 5 seconds
    fetchRuns();

    return () => clearInterval(interval);
  }, [owner, repo, packageName, limit]);

  const handleCancelRun = async (e: React.MouseEvent, run: WorkflowRun) => {
    e.stopPropagation();
    setActionInProgress(run.id);

    try {
      const token = localStorage.getItem('monodog_session_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      };

      const response = await fetch(
        `${apiUrl}/api/workflows/${owner}/${repo}/runs/${run.id}/cancel`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ pipelineId }),
        }
      );

      if (response.ok) {
        // Update the run status locally
        setRuns(runs.map(r =>
          r.id === run.id
            ? { ...r, status: 'completed', conclusion: 'cancelled' }
            : r
        ));
      } else {
        throw new Error('Failed to cancel run');
      }
    } catch (err) {
      console.error('Failed to cancel run:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel run');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRerunRun = async (e: React.MouseEvent, run: WorkflowRun) => {
    e.stopPropagation();
    setActionInProgress(run.id);

    try {
      const token = localStorage.getItem('monodog_session_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      };

      const response = await fetch(
        `${apiUrl}/api/workflows/${owner}/${repo}/runs/${run.id}/rerun`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ pipelineId, failedOnly: false }),
        }
      );

      if (response.ok) {
        // Update the run status locally
        setRuns(runs.map(r =>
          r.id === run.id
            ? { ...r, status: 'in_progress', conclusion: null }
            : r
        ));
      } else {
        throw new Error('Failed to rerun workflow');
      }
    } catch (err) {
      console.error('Failed to rerun workflow:', err);
      setError(err instanceof Error ? err.message : 'Failed to rerun workflow');
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading && runs.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin">
          <ClockIcon className="h-6 w-6 text-blue-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 border border-red-200">
        <p className="text-sm text-red-800">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {runs.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">No workflow runs found</p>
      ) : (
        runs.map(run => (
          <div
            key={run.id}
            className={`text-left p-3 rounded-lg border transition-colors ${
              runId === run.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <button
              onClick={() => onSelectRun?.(run.id)}
              className="w-full text-left"
            >
              <div className="flex items-start gap-2">
                {getStatusIcon(run.status, run.conclusion)}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-gray-900">
                    {run.name}
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(
                        run.status,
                        run.conclusion
                      )}`}
                    >
                      {run.conclusion ?? run.status}
                    </span>
                    <span> • </span>
                    <span>Branch: {run.head_branch}</span>
                    <span> • </span>
                    <span>by {run.actor.login}</span>
                    <span> • </span>
                    <span>{formatDate(run.created_at)}</span>
                  </p>
                </div>
              </div>
            </button>

            {hasPermission('maintain') && (
              <div className="flex gap-2 mt-3">
                {run.status === 'in_progress' && (
                  <button
                    onClick={e => handleCancelRun(e, run)}
                    disabled={actionInProgress === run.id}
                    className="flex-1 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Cancel this workflow run"
                  >
                    {actionInProgress === run.id
                      ? 'Cancelling...'
                      : 'Cancel Run'}
                  </button>
                )}
                {(run.conclusion === 'cancelled' ||
                  run.conclusion === 'failure') && (
                  <button
                    onClick={e => handleRerunRun(e, run)}
                    disabled={actionInProgress === run.id}
                    className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Rerun this workflow"
                  >
                    {actionInProgress === run.id ? 'Rerunning...' : 'Rerun'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
