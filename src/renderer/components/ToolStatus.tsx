interface ToolUse {
  name: string;
  status: 'executing' | 'complete' | 'error';
}

interface Props {
  toolUses: ToolUse[];
}

export default function ToolStatus({ toolUses }: Props) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
        Tools Used
      </div>
      <div className="flex flex-wrap gap-2">
        {toolUses.map((tool, index) => (
          <div
            key={index}
            className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${
              tool.status === 'executing'
                ? 'bg-blue-900/30 text-blue-300 border border-blue-700'
                : tool.status === 'complete'
                ? 'bg-green-900/30 text-green-300 border border-green-700'
                : 'bg-red-900/30 text-red-300 border border-red-700'
            }`}
          >
            <span>
              {tool.status === 'executing' && '⏳'}
              {tool.status === 'complete' && '✅'}
              {tool.status === 'error' && '❌'}
            </span>
            <span>{tool.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
