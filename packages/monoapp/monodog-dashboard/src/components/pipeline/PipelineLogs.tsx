/**
 * Pipeline Logs Component
 * Displays detailed pipeline execution logs with filtering and search
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowDownIcon, ArrowUpIcon, MagnifyingGlassIcon, XMarkIcon } from '../../icons/index';

interface LogEntry {
  id: string;
  publishPipelineId: string;
  packageName: string | null;
  stage: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  details: string | null;
  timestamp: string;
}

interface PipelineLogsProps {
  pipelineId?: string;
  showAllPipelines?: boolean;
  limit?: number;
}

const getLevelColor = (level: string) => {
  switch (level) {
    case 'error':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'warning':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'debug':
      return 'bg-gray-100 text-gray-800 border-gray-300';
    case 'info':
    default:
      return 'bg-blue-100 text-blue-800 border-blue-300';
  }
};

const getLevelBadge = (level: string) => {
  switch (level) {
    case 'error':
      return '❌';
    case 'warning':
      return '⚠️';
    case 'debug':
      return '🔍';
    case 'info':
    default:
      return 'ℹ️';
  }
};

export default function PipelineLogs({
  pipelineId,
  showAllPipelines = false,
  limit = 100,
}: PipelineLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, pipelineId, showAllPipelines, selectedLevel, selectedStage]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let url = '/api/pipelines';

      if (pipelineId) {
        url += `/${pipelineId}/logs`;
        if (selectedLevel) url += `?level=${selectedLevel}`;
        if (selectedStage) url += `${url.includes('?') ? '&' : '?'}stage=${selectedStage}`;
        if (selectedPackage) url += `${url.includes('?') ? '&' : '?'}packageName=${selectedPackage}`;
      } else if (showAllPipelines) {
        url += `/logs/recent?limit=${limit}`;
        if (selectedLevel) url += `&level=${selectedLevel}`;
        if (selectedStage) url += `&stage=${selectedStage}`;
      }

      const response = await axios.get(url);
      setLogs(response.data.logs || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedLevel && log.level !== selectedLevel) {
      return false;
    }
    if (selectedStage && log.stage !== selectedStage) {
      return false;
    }
    if (selectedPackage && log.packageName !== selectedPackage) {
      return false;
    }
    return true;
  });

  const stages = [...new Set(logs.map(log => log.stage))].sort();
  const packages = [...new Set(logs.filter(log => log.packageName).map(log => log.packageName))].sort();
  const levels = ['error', 'warning', 'info', 'debug'];

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return timestamp;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const parseDetails = (details: string | null) => {
    if (!details) return null;
    try {
      return JSON.parse(details);
    } catch {
      return details;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Pipeline Logs</h2>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            autoRefresh
              ? 'bg-green-100 text-green-800 border border-green-300'
              : 'bg-gray-100 text-gray-800 border border-gray-300'
          }`}
        >
          {autoRefresh ? '🔄 Auto-refresh ON' : '⏸ Auto-refresh OFF'}
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-2">
        <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search logs..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Level Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Level
            </label>
            <select
              value={selectedLevel || ''}
              onChange={e => setSelectedLevel(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Levels</option>
              {levels.map(level => (
                <option key={level} value={level}>
                  {getLevelBadge(level)} {level.charAt(0).toUpperCase() + level.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Stage Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stage
            </label>
            <select
              value={selectedStage || ''}
              onChange={e => setSelectedStage(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Stages</option>
              {stages.map(stage => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </div>

          {/* Package Filter */}
          {packages.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Package
              </label>
              <select
                value={selectedPackage || ''}
                onChange={e => setSelectedPackage(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Packages</option>
                {packages.map(pkg => (
                  <option key={pkg} value={pkg}>
                    {pkg}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error loading logs</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Logs */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No logs found</p>
            {logs.length > 0 && (
              <p className="text-sm mt-2">Try adjusting your filters or search query</p>
            )}
          </div>
        ) : (
          filteredLogs.map(log => (
            <div
              key={log.id}
              className={`border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow ${getLevelColor(
                log.level
              )}`}
              onClick={() =>
                setExpandedLogId(expandedLogId === log.id ? null : log.id)
              }
            >
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">
                  {getLevelBadge(log.level)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium break-words">
                        {log.message}
                      </p>
                      <div className="text-xs opacity-75 mt-1 space-y-1">
                        <div>
                          <span className="font-medium">Stage:</span> {log.stage}
                        </div>
                        {log.packageName && (
                          <div>
                            <span className="font-medium">Package:</span>{' '}
                            {log.packageName}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Time:</span>{' '}
                          {formatTimestamp(log.timestamp)}
                        </div>
                      </div>
                    </div>
                    {expandedLogId === log.id ? (
                      <ArrowUpIcon className="w-5 h-5 flex-shrink-0 mt-1" />
                    ) : (
                      <ArrowDownIcon className="w-5 h-5 flex-shrink-0 mt-1" />
                    )}
                  </div>

                  {/* Expanded Details */}
                  {expandedLogId === log.id && log.details && (
                    <div className="mt-3 pt-3 border-t border-current border-opacity-30">
                      <p className="text-xs font-medium mb-2">Details:</p>
                      <pre className="text-xs bg-black bg-opacity-10 rounded p-2 overflow-x-auto">
                        {typeof parseDetails(log.details) === 'string'
                          ? parseDetails(log.details)
                          : JSON.stringify(parseDetails(log.details), null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {filteredLogs.length > 0 && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <span className="font-medium">Total:</span> {filteredLogs.length}
            </div>
            <div>
              <span className="font-medium">Errors:</span>{' '}
              {filteredLogs.filter(l => l.level === 'error').length}
            </div>
            <div>
              <span className="font-medium">Warnings:</span>{' '}
              {filteredLogs.filter(l => l.level === 'warning').length}
            </div>
            <div>
              <span className="font-medium">Info:</span>{' '}
              {filteredLogs.filter(l => l.level === 'info').length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
