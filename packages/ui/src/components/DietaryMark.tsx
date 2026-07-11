import { cn } from '../cn';

export type DietaryType = 'veg' | 'non_veg';

interface DietaryMarkProps {
  type: DietaryType;
  size?: number;
  className?: string;
}

// Standard veg/non-veg indicator: a green square with a green dot for
// vegetarian, a brown/maroon square with a brown/maroon triangle for
// non-vegetarian — the same mark used on menus and packaging across South
// Asia, so it reads instantly without a legend.
export function DietaryMark({ type, size = 14, className }: DietaryMarkProps) {
  const color = type === 'veg' ? '#16A34A' : '#7C2D12';
  const label = type === 'veg' ? 'Vegetarian' : 'Non-Vegetarian';
  const markSize = Math.round(size * 0.42);

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn('inline-flex items-center justify-center shrink-0', className)}
      style={{
        width: size,
        height: size,
        border: `1.5px solid ${color}`,
        borderRadius: Math.max(1, Math.round(size * 0.12)),
      }}
    >
      {type === 'veg' ? (
        <span
          style={{
            width: markSize,
            height: markSize,
            borderRadius: '50%',
            backgroundColor: color,
          }}
        />
      ) : (
        <span
          style={{
            width: 0,
            height: 0,
            borderLeft: `${markSize * 0.6}px solid transparent`,
            borderRight: `${markSize * 0.6}px solid transparent`,
            borderBottom: `${markSize}px solid ${color}`,
          }}
        />
      )}
    </span>
  );
}
