export default function Loading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Carregando">
      <div className="mb-5">
        <div className="h-5 w-40 rounded-[4px] bg-gray-200" />
        <div className="mt-2 h-3.5 w-72 max-w-full rounded-[4px] bg-gray-100" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-[6px] border border-gray-200 bg-white" />
        ))}
      </div>

      <div className="mt-5 rounded-[6px] border border-gray-200 bg-white">
        <div className="h-11 border-b border-gray-200" />
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 rounded-[4px] bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
