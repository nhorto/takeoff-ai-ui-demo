import { useState } from 'react';

interface Props {
  onSubmit: (apiKey: string) => void;
}

export default function ApiKeySetup({ onSubmit }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    if (!apiKey.startsWith('sk-ant-')) {
      setError('Invalid API key format. Anthropic API keys start with "sk-ant-"');
      return;
    }

    onSubmit(apiKey.trim());
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-md p-8">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">TakeoffAI</h1>
            <p className="text-gray-400">Construction Quantity Takeoff</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-2">
                Anthropic API Key
              </label>
              <input
                type="password"
                id="apiKey"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError('');
                }}
                placeholder="sk-ant-..."
                className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-red-400">{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
            >
              Continue
            </button>

            <div className="mt-6 text-sm text-gray-400">
              <p className="mb-2">Your API key is stored locally and never sent to our servers.</p>
              <p>
                Don't have an API key?{' '}
                <a
                  href="https://console.anthropic.com/"
                  className="text-blue-400 hover:text-blue-300"
                  onClick={(e) => {
                    e.preventDefault();
                    // TODO: Open in external browser
                    console.log('Open Anthropic console');
                  }}
                >
                  Get one here
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
