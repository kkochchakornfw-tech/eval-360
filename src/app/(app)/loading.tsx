export default function Loading() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="h-7 w-48 animate-pulse rounded-md bg-stone-200" />
      <div className="h-4 w-72 animate-pulse rounded-md bg-stone-100" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-stone-100" />
        ))}
      </div>
    </div>
  );
}
