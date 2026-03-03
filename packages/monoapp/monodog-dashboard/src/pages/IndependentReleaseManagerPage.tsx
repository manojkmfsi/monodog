/**
 * Independent Release Manager Page
 * Manages packages and publishes using the new independent release engine
 */

import React, { useState, useEffect } from 'react';
import IndependentReleaseInfo from '../components/IndependentReleaseInfo';
import releaseAPI from '../services/release-api';
import styles from './IndependentReleaseManagerPage.module.css';

interface Package {
  name: string;
  version: string;
  path: string;
}

interface ReadinessCheck {
  packageName: string;
  isReady: boolean;
  blockers: string[];
  warnings: string[];
}

export default function IndependentReleaseManagerPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [readiness, setReadiness] = useState<ReadinessCheck[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const res = await releaseAPI.getPackages();
      if (res.success) {
        setPackages(res.data.packages || []);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch packages');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPackage = (packageName: string) => {
    setSelectedPackages(prev =>
      prev.includes(packageName)
        ? prev.filter(p => p !== packageName)
        : [...prev, packageName]
    );
  };

  const handleCheckReadiness = async () => {
    if (selectedPackages.length === 0) {
      setError('Please select at least one package');
      return;
    }

    try {
      setLoading(true);
      const packagePaths = selectedPackages.reduce((acc, pkgName) => {
        const pkg = packages.find(p => p.name === pkgName);
        if (pkg) {
          acc[pkgName] = pkg.path;
        }
        return acc;
      }, {} as Record<string, string>);

      const res = await releaseAPI.checkReadiness(selectedPackages, packagePaths);
      if (res.success) {
        setReadiness(res.data.checks || []);
        setError(null);
      } else {
        setError(res.error?.message || 'Failed to check readiness');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check readiness');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (selectedPackages.length === 0) {
      setError('Please select at least one package');
      return;
    }

    try {
      setPublishing(true);
      const packagePaths = selectedPackages.reduce((acc, pkgName) => {
        const pkg = packages.find(p => p.name === pkgName);
        if (pkg) {
          acc[pkgName] = pkg.path;
        }
        return acc;
      }, {} as Record<string, string>);

      const res = await releaseAPI.startPublish(selectedPackages, packagePaths, {
        method: 'node',
        dryRun,
        autoTag: true,
        createReleases: false,
      });

      if (res.success) {
        setError(null);
        // Reset selections
        setSelectedPackages([]);
        setReadiness(null);
        alert(
          dryRun
            ? `✅ Dry-run successful for ${selectedPackages.length} package(s)`
            : `✅ Publishing started for ${selectedPackages.length} package(s)\nPipeline ID: ${res.data.pipelineId}`
        );
      } else {
        setError(res.error?.message || 'Failed to start publish');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start publish');
    } finally {
      setPublishing(false);
    }
  };

  const selectedReadiness = readiness?.filter(r =>
    selectedPackages.includes(r.packageName)
  );
  const allReady = selectedReadiness?.every(r => r.isReady) ?? false;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🚀 Independent Release Manager</h1>
        <p>New release system independent of Changesets</p>
      </div>

      <IndependentReleaseInfo />

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.content}>
        <div className={styles.section}>
          <h2>Step 1: Select Packages</h2>
          {loading && !packages.length ? (
            <p>Loading packages...</p>
          ) : packages.length === 0 ? (
            <p>No packages found</p>
          ) : (
            <div className={styles.packageList}>
              {packages.map(pkg => (
                <label key={pkg.name} className={styles.packageItem}>
                  <input
                    type="checkbox"
                    checked={selectedPackages.includes(pkg.name)}
                    onChange={() => handleSelectPackage(pkg.name)}
                  />
                  <span className={styles.packageName}>{pkg.name}</span>
                  <span className={styles.packageVersion}>v{pkg.version}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h2>Step 2: Check Readiness</h2>
          <button
            onClick={handleCheckReadiness}
            disabled={selectedPackages.length === 0 || loading}
            className={styles.button}
          >
            Check Readiness
          </button>

          {selectedReadiness && selectedReadiness.length > 0 && (
            <div className={styles.readinessResults}>
              {selectedReadiness.map(check => (
                <div
                  key={check.packageName}
                  className={`${styles.readinessItem} ${
                    check.isReady ? styles.ready : styles.notReady
                  }`}
                >
                  <div className={styles.readinessHeader}>
                    <span className={styles.readinessStatus}>
                      {check.isReady ? '✅' : '❌'}
                    </span>
                    <span className={styles.readinessName}>{check.packageName}</span>
                  </div>
                  {check.blockers.length > 0 && (
                    <div className={styles.readinessBlockers}>
                      <strong>Blockers:</strong>
                      <ul>
                        {check.blockers.map((blocker, i) => (
                          <li key={i}>{blocker}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {check.warnings.length > 0 && (
                    <div className={styles.readinessWarnings}>
                      <strong>Warnings:</strong>
                      <ul>
                        {check.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.section}>
          <h2>Step 3: Publish Packages</h2>

          <div className={styles.options}>
            <label className={styles.option}>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={e => setDryRun(e.target.checked)}
              />
              <span>Dry-run (test without publishing)</span>
            </label>
          </div>

          <button
            onClick={handlePublish}
            disabled={selectedPackages.length === 0 || publishing || !allReady}
            className={`${styles.button} ${styles.publishButton}`}
          >
            {publishing ? 'Publishing...' : dryRun ? 'Test Publish (Dry-run)' : 'Publish to npm'}
          </button>

          {selectedPackages.length > 0 && !allReady && !dryRun && (
            <div className={styles.warning}>
              ⚠️ Some packages are not ready. Run dry-run first or fix blockers.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
