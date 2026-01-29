import { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function Settings({ isOpen, onClose }: Props) {
  const [outputDirectory, setOutputDirectory] = useState('');
  const [defaultDirectory, setDefaultDirectory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [sessionDir, setSessionDir] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  async function loadSettings() {
    try {
      const [configured, defaultDir, currentSession] = await Promise.all([
        window.electronAPI.getOutputDirectory(),
        window.electronAPI.getDefaultOutputDirectory(),
        window.electronAPI.getSessionDir()
      ]);
      setOutputDirectory(configured);
      setDefaultDirectory(defaultDir);
      setSessionDir(currentSession);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async function handleBrowse() {
    const selected = await window.electronAPI.browseOutputDirectory();
    if (selected) {
      setOutputDirectory(selected);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveMessage('');
    try {
      await window.electronAPI.setOutputDirectory(outputDirectory);
      setSaveMessage('Settings saved!');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch (error) {
      setSaveMessage('Failed to save settings');
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset() {
    setOutputDirectory('');
    await window.electronAPI.setOutputDirectory('');
    setSaveMessage('Reset to defaults');
    setTimeout(() => setSaveMessage(''), 2000);
  }

  async function handleOpenSessionImages() {
    try {
      await window.electronAPI.openSessionImages();
    } catch (error) {
      console.error('Failed to open session images:', error);
      setSaveMessage('No active session');
      setTimeout(() => setSaveMessage(''), 2000);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 sticky top-0 bg-gray-800">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Output Directory */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Output Directory
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Where takeoff CSV files and summaries are saved. Each session creates a timestamped subfolder.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={outputDirectory}
                onChange={(e) => setOutputDirectory(e.target.value)}
                placeholder={defaultDirectory || 'Using default location'}
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleBrowse}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition text-sm"
              >
                Browse
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Default: {defaultDirectory}
            </p>
          </div>

          {/* Debug: View Session Images */}
          <div className="border-t border-gray-700 pt-6">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Debug: View Images</h3>
            <p className="text-xs text-gray-500 mb-3">
              Open the folder containing the images that Claude sees. Use this to verify image quality.
            </p>
            <button
              onClick={handleOpenSessionImages}
              disabled={!sessionDir}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
              </svg>
              Open Session Images Folder
            </button>
            {!sessionDir && (
              <p className="text-xs text-yellow-500 mt-2">
                No active session. Start a takeoff to create a session.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700 bg-gray-800/50 rounded-b-lg sticky bottom-0">
          <div className="flex items-center gap-4">
            <button
              onClick={handleReset}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Reset to Defaults
            </button>
            {saveMessage && (
              <span className="text-sm text-green-400">{saveMessage}</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-lg transition"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
