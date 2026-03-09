import { useState, useEffect } from 'react';
import { CheckIcon, ExclamationCircleIcon } from '../../../icons';
import apiClient from '../../../services/api';

// Simple Icon Components for Token Management
const AlertIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth="2"
    stroke="currentColor"
    className={className || 'w-5 h-5'}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const EyeIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth="2"
    stroke="currentColor"
    className={className || 'w-4 h-4'}
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth="2"
    stroke="currentColor"
    className={className || 'w-4 h-4'}
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const LoaderIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth="2"
    stroke="currentColor"
    className={className || 'w-4 h-4'}
  >
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="4.22" y1="4.22" x2="7.34" y2="7.34" />
    <line x1="16.66" y1="16.66" x2="19.78" y2="19.78" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
    <line x1="4.22" y1="19.78" x2="7.34" y2="16.66" />
    <line x1="16.66" y1="7.34" x2="19.78" y2="4.22" />
  </svg>
);

interface TokenStatus {
  npm: { configured: boolean; source: string };
  github: { configured: boolean; source: string };
}

export default function TokenManagement() {
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [npmToken, setNpmToken] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [showNpmToken, setShowNpmToken] = useState(false);
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // GitHub secret sync status
  const [githubSecretStatus, setGithubSecretStatus] = useState<{
    synced?: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  // Fetch token status on mount
  useEffect(() => {
    fetchTokenStatus();
  }, []);

  const fetchTokenStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/tokens/status');

      if (response.success) {
        setTokenStatus((response as any).tokens);
      } else {
        setError((response as any).error || 'Failed to fetch token status');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Error fetching token status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateToken = async (tokenType: 'npm' | 'github') => {
    const tokenValue = tokenType === 'npm' ? npmToken : githubToken;

    if (!tokenValue.trim()) {
      setError(`Please enter a ${tokenType} token`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const response = await apiClient.post(
        '/tokens/update',
        JSON.stringify({
          tokenType,
          tokenValue,
        })
      );

      if (response.success) {
        setSuccessMessage(`${tokenType.toUpperCase()} token updated successfully`);

        // If GitHub token was updated, show secret sync status
        if (tokenType === 'github') {
          const details = (response as any).details;
          if (details) {
            if (details.githubSecretUpdated) {
              setGithubSecretStatus({
                synced: true,
                message: 'GitHub repository secret updated successfully',
              });
            } else if (details.githubSecretError) {
              setGithubSecretStatus({
                synced: false,
                error: details.githubSecretError,
              });
            }
          }
        }

        if (tokenType === 'npm') {
          setNpmToken('');
        } else {
          setGithubToken('');
        }
        // Refresh status
        setTimeout(() => fetchTokenStatus(), 1000);
      } else {
        setError((response as any).error || `Failed to update ${tokenType} token`);
      }
    } catch (err) {
      setError('Failed to update token');
      console.error('Error updating token:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateShortLivedToken = async () => {
    try {
      setSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const response = await apiClient.post('/tokens/generate-github-token', JSON.stringify({}));

      if (response.success) {
        const token = (response as any).token;
        const expiresIn = (response as any).expiresIn;
        const warning = (response as any).warning;
        
        setGithubToken(token);
        setSuccessMessage(
          `GitHub token ready (expires ${expiresIn || 'when revoked'})`
        );

        // Show warning if present
        if (warning) {
          setError(warning);
        }

        // Auto-update the token
        const updateResponse = await apiClient.post(
          '/tokens/update',
          JSON.stringify({
            tokenType: 'github',
            tokenValue: token,
          })
        );

        if (
          updateResponse.success &&
          ((updateResponse as any).details?.githubSecretUpdated || false)
        ) {
          setGithubSecretStatus({
            synced: true,
            message: 'GitHub repository secret synced successfully',
          });
        }

        setTimeout(() => fetchTokenStatus(), 1000);
      } else {
        setError((response as any).error || 'Failed to generate token');
        const message = (response as any).message;
        if (message) {
          console.log('Token generation details:', message);
        }
      }
    } catch (err) {
      setError('Failed to generate GitHub token');
      console.error('Error generating token:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const TokenStatusBadge = ({ configured, source }: { configured: boolean; source: string }) => (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
      configured
        ? 'bg-green-100 text-green-800'
        : 'bg-yellow-100 text-yellow-800'
    }`}>
      {configured ? (
        <CheckIcon className="w-4 h-4" />
      ) : (
        <ExclamationCircleIcon className="w-4 h-4" />
      )}
      <span>{source}</span>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoaderIcon className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-600">Loading token status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Token Management</h1>
        <p className="text-gray-600">
          Update your GitHub and NPM tokens to maintain workflow automation
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <ExclamationCircleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-green-900">Success</h3>
            <p className="text-green-700 text-sm">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Current Status Section */}
      {tokenStatus && (
        <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Current Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">NPM Token</h3>
              <TokenStatusBadge
                configured={tokenStatus.npm.configured}
                source={tokenStatus.npm.source}
              />
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">GitHub Token</h3>
              <TokenStatusBadge
                configured={tokenStatus.github.configured}
                source={tokenStatus.github.source}
              />
            </div>
          </div>
        </div>
      )}

      {/* Update Forms Section */}
      <div className="space-y-8">
        {/* NPM Token Form */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Update NPM Token</h2>
          <p className="text-gray-600 text-sm mb-4">
            Provide your NPM authentication token to enable package publishing. You can create tokens at{' '}
            <a
              href="https://www.npmjs.com/settings/~/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              npmjs.com/settings
            </a>
          </p>

          <div className="relative mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">NPM Token</label>
            <div className="relative">
              <input
                type={showNpmToken ? 'text' : 'password'}
                value={npmToken}
                onChange={(e) => setNpmToken(e.target.value)}
                placeholder="npm_..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowNpmToken(!showNpmToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showNpmToken ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <button
            onClick={() => handleUpdateToken('npm')}
            disabled={submitting}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-medium flex items-center justify-center gap-2"
          >
            {submitting && <LoaderIcon className="w-4 h-4 animate-spin" />}
            Update NPM Token
          </button>
        </div>

        {/* GitHub Short-Lived Token Section */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Generate Short-Lived GitHub Token</h2>
          <p className="text-gray-600 text-sm mb-4">
            Generate a short-lived GitHub token that automatically syncs to your repository secrets. These tokens expire after 1 hour and are more secure than long-lived personal access tokens.
          </p>

          <button
            onClick={handleGenerateShortLivedToken}
            disabled={submitting}
            className="w-full px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-medium flex items-center justify-center gap-2"
          >
            {submitting && <LoaderIcon className="w-4 h-4 animate-spin" />}
            {submitting ? 'Generating...' : 'Generate and Sync Token'}
          </button>

          {githubSecretStatus && (
            <div className="mt-4">
              {githubSecretStatus.synced ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                  <CheckIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-green-800 text-sm font-medium">Token Synced Successfully</p>
                    <p className="text-green-700 text-xs">
                      {githubSecretStatus.message || 'Short-lived token synced to repository secrets'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                  <ExclamationCircleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-800 text-sm font-medium">Sync Warning</p>
                    <p className="text-yellow-700 text-xs">
                      {githubSecretStatus.error || 'Could not sync to GitHub repository secrets'}
                    </p>
                    <p className="text-yellow-700 text-xs mt-1">
                      Try generating again or check your repository permissions.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Information Section */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Why do we need these credentials?</h3>
        <ul className="text-blue-800 text-sm space-y-2 list-disc list-inside">
          <li><strong>NPM Token:</strong> Required to publish packages to the NPM registry</li>
          <li><strong>GitHub Connection:</strong> Securely authenticate with GitHub for creating releases, managing workflows, committing changes, and workflow automation. Your token is automatically synced to repository secrets for CI/CD usage.</li>
        </ul>
      </div>
    </div>
  );
}
