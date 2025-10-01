import React from 'react';
import { CHANGELOG_VERSIONS } from '../constants';

interface ChangelogOverlayProps {
  onClose: () => void;
}

export const ChangelogOverlay: React.FC<ChangelogOverlayProps> = ({ onClose }) => {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center backdrop-blur-md z-30">
      <div className="bg-indigo-950 border border-fuchsia-800 rounded-2xl p-8 shadow-2xl shadow-fuchsia-500/20 text-white w-full max-w-2xl h-[80vh]">
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-4xl font-bold text-cyan-300">Changelog</h1>
            <button onClick={onClose} className="bg-fuchsia-700 hover:bg-fuchsia-600 text-white font-bold py-2 px-6 rounded-lg text-lg">
                Close
            </button>
        </div>
        <div className="space-y-6 overflow-y-auto h-[calc(100%-4rem)] pr-4">
            {CHANGELOG_VERSIONS.map((v) => (
                <div key={v.version}>
                    <h2 className="text-2xl font-semibold mb-2 text-cyan-400">{v.version}</h2>
                    <ul className="list-disc list-inside space-y-1 text-gray-300 bg-black/30 border border-indigo-700 rounded-lg p-4">
                        {v.notes.map((note, i) => (
                            <li key={i}>{note}</li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};
