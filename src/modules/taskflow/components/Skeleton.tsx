import React from 'react';

export const Skeleton = React.memo(function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-surface-lighter rounded ${className}`}
      aria-hidden="true"
      role="presentation"
    />
  );
});

export function TaskCardSkeleton() {
  return (
    <div className="card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="w-16 h-5 rounded-full" />
        <Skeleton className="w-8 h-4" />
      </div>
      <Skeleton className="w-3/4 h-4" />
      <Skeleton className="w-full h-3" />
      <Skeleton className="w-2/3 h-3" />
      <div className="flex gap-1.5">
        <Skeleton className="w-12 h-5 rounded" />
        <Skeleton className="w-16 h-5 rounded" />
      </div>
      <div className="flex justify-between pt-2 border-t border-border">
        <Skeleton className="w-16 h-3" />
        <Skeleton className="w-20 h-3" />
      </div>
    </div>
  );
}

export function KanbanColumnSkeleton() {
  return (
    <div className="flex-shrink-0 w-72">
      <div className="card p-4">
        <Skeleton className="w-24 h-5 mb-4" />
        <div className="space-y-3">
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      </div>
    </div>
  );
}

export function ListRowSkeleton() {
  return (
    <tr className="border-b border-border">
      <td className="py-3 px-2">
        <Skeleton className="w-4 h-4 rounded" />
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-48 h-4 mb-1" />
        <Skeleton className="w-32 h-3" />
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-16 h-5 rounded-full" />
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-12 h-5 rounded-full" />
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-16 h-5 rounded-full" />
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-20 h-4" />
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-16 h-4" />
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-12 h-4" />
      </td>
      <td className="py-3 px-4">
        <Skeleton className="w-16 h-4" />
      </td>
    </tr>
  );
}
