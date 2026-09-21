export default function Loading() {
  return (
    <div className="min-h-screen animate-pulse bg-gray-50 px-4 py-6" role="status" aria-label="Carregando">
      <div className="mx-auto max-w-md space-y-4">
        <div className="h-6 w-48 rounded-[4px] bg-gray-200" />
        <div className="h-28 rounded-[10px] border border-gray-200 bg-white" />
        <div className="h-20 rounded-[10px] border border-gray-200 bg-white" />
        <div className="h-20 rounded-[10px] border border-gray-200 bg-white" />
      </div>
    </div>
  );
}
