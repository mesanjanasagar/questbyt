import type { ReactNode } from 'react';
import { ChevronDownIcon, MenuIcon } from '@pos/ui';

export interface POSNavSection {
  id: string;
  label: string;
  hasDropdown?: boolean;
}

interface POSTopNavProps {
  storeName: string;
  username: string;
  sections: POSNavSection[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  onMenuToggle?: () => void;
  rightSlot?: ReactNode;
}

export function POSTopNav({
  storeName,
  username,
  sections,
  activeSection,
  onSectionChange,
  onMenuToggle,
  rightSlot,
}: POSTopNavProps) {
  return (
    <header className="flex items-center h-11 bg-brand-900 text-white px-3 gap-4 shrink-0 select-none">
      {/* Brand */}
      <div className="flex items-center gap-2 shrink-0 pr-3 border-r border-brand-800/60">
        <div className="w-6 h-6 bg-white/15 rounded flex items-center justify-center text-[10px] font-extrabold text-white">
          {storeName.charAt(0)}
        </div>
        <span className="text-sm font-bold text-white tracking-tight whitespace-nowrap">
          {storeName}
        </span>
      </div>

      {/* Section tabs */}
      <nav className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
        {sections.map((section) => {
          const isActive = section.id === activeSection;
          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-semibold whitespace-nowrap transition-colors duration-100 ${
                isActive
                  ? 'bg-white text-brand-900'
                  : 'text-brand-300 hover:text-white hover:bg-brand-800/60'
              }`}
            >
              {section.label}
              {section.hasDropdown && (
                <ChevronDownIcon
                  size={12}
                  className={isActive ? 'text-brand-500' : 'text-brand-400 opacity-70'}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Right: greeting + notifications + hamburger */}
      <div className="flex items-center gap-3 shrink-0 pl-3 border-l border-brand-800/60">
        <span className="text-sm text-brand-200 whitespace-nowrap">
          Hi, <span className="font-semibold text-white">{username}!</span>
        </span>
        {rightSlot}
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="p-1 rounded text-brand-300 hover:text-white hover:bg-brand-800/60 transition-colors"
            aria-label="Open menu"
          >
            <MenuIcon size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
