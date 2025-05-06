import React, { useState } from 'react';

export const ApiKeyForm = ({ submit, error, isLoading }:{
  submit     : (v:{ apiKey:string })=>Promise<void>;
  error?     : string;
  isLoading? : boolean;
}) => {
  const [apiKey, setApiKey] = useState<string>("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim()) {
      setLocalError("Please enter an API key");
      return;
    }

    try {
      await submit({ apiKey: apiKey.trim() });
    } catch (err) {
      console.error("Failed to submit API key:", err);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">
          API Key Required
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Please enter your Anthropic API key to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium mb-1">
              Anthropic API Key
            </label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              placeholder="sk-ant-..."
            />
          </div>

          {localError && <div className="text-red-500 text-sm">{localError}</div>}
          {error && <div className="text-red-500 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
          >
            {isLoading ? "Submitting..." : "Submit"}
          </button>
        </form>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          <p>
            Your API key is stored locally in your browser and is only used for
            communicating with the Anthropic API.
          </p>
        </div>
      </div>
    </div>
  );
}; 