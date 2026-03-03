/**
 * Independent Release System Info Component
 * Shows status of the new independent release engine
 */

import React, { useState, useEffect } from 'react';
import releaseAPI from '../services/release-api';
import styles from './indep-release-info.module.css';

interface HealthStatus {
  status: string;
  activePipelines: number;
  totalPipelines: number;
  timestamp?: string;
}

export default function IndependentReleaseInfo() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        // Get health status
        const healthRes = await releaseAPI.getHealth();
        if (healthRes.success) {
          setHealth(healthRes.data);
        }

        // Get recent pipelines
        const pipelinesRes = await releaseAPI.getPipelines(undefined, 5);
        if (pipelinesRes.success) {
          setPipelines(pipelinesRes.data.pipelines || []);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch release status');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();

    // Refresh every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !health) {
    return (
      <div className={styles.container}>
        <p>Loading release system status...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>🚀 Independent Release Engine</h3>
        <p className={styles.subtitle}>New release system (independent of Changesets)</p>
      </div>

      {error && <div className={styles.error}>Error: {error}</div>}

      {health && (
        <div className={styles.healthSection}>
          <div className={styles.statusBadge}>
            <span className={styles.statusDot} data-status={health.status}></span>
            <span>System Status: <strong>{health.status}</strong></span>
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Active Pipelines</span>
              <span className={styles.statValue}>{health.activePipelines}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Total Pipelines</span>
              <span className={styles.statValue}>{health.totalPipelines}</span>
            </div>
          </div>

          {health.timestamp && (
            <p className={styles.timestamp}>
              Last updated: {new Date(health.timestamp).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      {pipelines.length > 0 && (
        <div className={styles.pipelinesSection}>
          <h4>Recent Pipelines</h4>
          <div className={styles.pipelinesList}>
            {pipelines.map((pipeline) => (
              <div key={pipeline.pipelineId} className={styles.pipelineItem}>
                <div className={styles.pipelineHeader}>
                  <span className={styles.pipelineId}>{pipeline.pipelineId}</span>
                  <span className={styles.pipelineStatus} data-status={pipeline.status}>
                    {pipeline.status}
                  </span>
                </div>
                <div className={styles.pipelineProgress}>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${pipeline.progress}%` }}
                    ></div>
                  </div>
                  <span className={styles.progressText}>{pipeline.progress}%</span>
                </div>
                <p className={styles.pipelinePackages}>
                  Packages: {pipeline.packagesToPublish?.join(', ') || 'None'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.featuresSection}>
        <h4>Key Features</h4>
        <ul>
          <li>✅ Independent of @changesets/cli</li>
          <li>✅ Git-based change detection (Conventional Commits)</li>
          <li>✅ Internal semantic versioning (SemVer)</li>
          <li>✅ Direct npm publishing (no CLI dependency)</li>
          <li>✅ Hybrid execution (Node.js + GitHub Actions)</li>
          <li>✅ Encrypted token handling</li>
          <li>✅ Full audit logging</li>
        </ul>
      </div>
    </div>
  );
}
