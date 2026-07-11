import { useState } from 'react';
import { cn } from '@pos/ui';
import type { MenuCategory } from '@pos/shared-types';

// 6-color pastel cycle — all from the Questbyt token palette
const TILE_BG = [
  'bg-neutral-100',  // warm gray
  'bg-primary-50',   // light blue
  'bg-success-50',   // light green
  'bg-accent-50',    // light amber
  'bg-info-50',      // light sky
  'bg-brand-50',     // light navy-tint
] as const;

// Matching text colors per background for sufficient contrast
const TILE_TEXT = [
  'text-neutral-700',
  'text-primary-800',
  'text-success-800',
  'text-accent-800',
  'text-info-800',
  'text-brand-800',
] as const;

interface CategoryGridProps {
  categories: MenuCategory[];
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
  /** Number of tiles per page. Default: 18 (3 rows × 6 cols). */
  itemsPerPage?: number;
  /** Override the section heading. Default: "Menu Categories" */
  heading?: string;
}

export function CategoryGrid({
  categories,
  selectedId,
  onSelect,
  itemsPerPage = 18,
  heading = 'Menu Categories',
}: CategoryGridProps) {
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(categories.length / itemsPerPage));
  const visiblePage = Math.min(page, totalPages - 1);
  const pageItems = categories.slice(
    visiblePage * itemsPerPage,
    (visiblePage + 1) * itemsPerPage,
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3 px-1 shrink-0">
        <h2 className="text-subheading">{heading}</h2>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={cn(
                  'w-8 h-8 rounded-lg text-sm font-semibold transition-colors duration-100',
                  i === visiblePage
                    ? 'bg-brand-900 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
                )}
                aria-label={`Page ${i + 1}`}
                aria-current={i === visiblePage ? 'page' : undefined}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category tile grid */}
      <div className="grid grid-cols-6 gap-2.5 auto-rows-fr flex-1">
        {pageItems.map((category, idx) => {
          const colorIdx = (visiblePage * itemsPerPage + idx) % TILE_BG.length;
          const isSelected = category.id === selectedId;

          return (
            <button
              key={category.id}
              onClick={() => onSelect(category.id)}
              className={cn(
                'flex items-center justify-center rounded-xl border-2 p-3 text-center',
                'transition-all duration-100 active:scale-95',
                TILE_BG[colorIdx],
                isSelected
                  ? 'border-primary-500 ring-2 ring-primary-400 ring-offset-1 shadow-sm'
                  : 'border-transparent hover:brightness-95',
              )}
            >
              <span
                className={cn(
                  'text-sm font-semibold leading-tight line-clamp-3',
                  isSelected ? 'text-primary-800' : TILE_TEXT[colorIdx],
                )}
              >
                {category.name}
              </span>
            </button>
          );
        })}

        {/* Empty placeholders to keep grid shape on partial last page */}
        {Array.from({ length: itemsPerPage - pageItems.length }).map((_, i) => (
          <div key={`empty-${i}`} className="rounded-xl bg-neutral-50 border-2 border-dashed border-neutral-200 opacity-30" />
        ))}
      </div>
    </div>
  );
}
