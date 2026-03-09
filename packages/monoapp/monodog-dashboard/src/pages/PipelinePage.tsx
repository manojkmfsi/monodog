import React, { useState } from 'react';
import PipelineManager from '../components/pipeline/PipelineManager';
import PipelineLogs from '../components/pipeline/PipelineLogs';
import { useAuth } from '../services/auth-context';

export default function PipelinePage() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState<'manager' | 'logs'>('manager');

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-600">Please sign in to view pipelines</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-white">
        <div className="flex gap-8 px-6">
          <button
            onClick={() => setActiveTab('manager')}
            className={`py-4 px-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'manager'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Pipeline Manager
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-4 px-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Pipeline Logs
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'manager' && (
          <div className="h-full overflow-hidden">
            <PipelineManager />
          </div>
        )}
        {activeTab === 'logs' && (
          <div className="h-full overflow-y-auto p-6">
            <PipelineLogs showAllPipelines={true} limit={200} />
          </div>
        )}
      </div>
    </div>
  );
}
