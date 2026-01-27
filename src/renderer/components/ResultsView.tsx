interface TakeoffResult {
  csvPath?: string;
  summaryPath?: string;
  stats: {
    iterations: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

interface Props {
  results: TakeoffResult | null;
}

export default function ResultsView({ results }: Props) {
  async function openOutputsFolder() {
    try {
      const outputsDir = await window.electronAPI.getOutputsDirectory();
      await window.electronAPI.openOutputFile(outputsDir);
    } catch (error) {
      console.error('Failed to open outputs folder:', error);
    }
  }

  if (!results) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-lg">Results will appear here</p>
          <p className="text-sm mt-2">Upload a PDF to start</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-white mb-6">Takeoff Results</h2>

      {/* Statistics */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Statistics
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Iterations:</span>
            <span className="text-white font-medium">{results.stats.iterations}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Total Tokens:</span>
            <span className="text-white font-medium">{results.stats.totalTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Estimated Cost:</span>
            <span className="text-white font-medium">${results.stats.estimatedCost.toFixed(4)}</span>
          </div>
        </div>
      </div>

      {/* Output files */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Output Files
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Check the chat for generated files. They have been saved to your outputs folder.
        </p>
        <button
          onClick={openOutputsFolder}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center space-x-2"
        >
          <span>📁</span>
          <span>Open Outputs Folder</span>
        </button>
      </div>

      {/* Help text */}
      <div className="mt-6 text-xs text-gray-500">
        <p>
          CSV files can be imported into PowerFab or opened with Excel.
          Summary reports provide coordination notes and code compliance checks.
        </p>
      </div>
    </div>
  );
}
