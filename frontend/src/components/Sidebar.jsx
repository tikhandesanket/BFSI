const SAMPLE_QUERIES = [
  "How do I open a savings account?",
  "What are the home loan interest rates?",
  "My credit card was stolen — what should I do?",
  "What is the difference between NEFT and RTGS?",
  "How often must KYC be updated?",
  "What are the current FD interest rates?",
];

export default function Sidebar({ health, onPick }) {
  return (
    <aside className="hidden md:flex md:w-72 flex-col border-r border-slate-200 bg-white">
      <div className="p-5 border-b border-slate-200">
        <div className="text-lg font-bold text-slate-900">Banking Assistant</div>
        <div className="text-xs text-slate-500 mt-1">
          RAG · Query Routing · Hallucination Guard
        </div>
      </div>

      <div className="p-5 border-b border-slate-200">
        <div className="text-xs font-semibold uppercase text-slate-500 mb-2">Status</div>
        {health ? (
          <div className="text-sm text-slate-700">
            <div>
              <span className="text-emerald-600">●</span> Online
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {health.documents} docs · {health.categories?.length ?? 0} categories
            </div>
          </div>
        ) : (
          <div className="text-sm text-rose-600">● Offline</div>
        )}
      </div>

      <div className="p-5 flex-1 overflow-y-auto">
        <div className="text-xs font-semibold uppercase text-slate-500 mb-2">
          Try a question
        </div>
        <ul className="space-y-1.5">
          {SAMPLE_QUERIES.map((q) => (
            <li key={q}>
              <button
                onClick={() => onPick(q)}
                className="w-full text-left rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:border-brand-100 transition"
              >
                {q}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-4 border-t border-slate-200 text-xs text-slate-500">
        Demo — for informational purposes only.
      </div>
    </aside>
  );
}
