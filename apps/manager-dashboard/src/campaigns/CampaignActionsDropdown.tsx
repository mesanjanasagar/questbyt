import React, { useState, useRef, useEffect } from 'react';
import {
  MoreHorizontalIcon, EyeIcon, EditIcon, TrashIcon,
  CheckIcon, XIcon, DownloadIcon,
} from '@pos/ui';
import type { Campaign } from '@pos/shared-types';

interface Action {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  divider?: boolean;
}

interface CampaignActionsDropdownProps {
  campaign: Campaign;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onStatusChange: (status: Campaign['status']) => void;
  onDelete: () => void;
}

export function CampaignActionsDropdown({
  campaign,
  onView,
  onEdit,
  onDuplicate,
  onStatusChange,
  onDelete,
}: CampaignActionsDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const statusActions: Action[] = [];
  const { status } = campaign;

  if (status === 'draft' || status === 'paused' || status === 'scheduled') {
    statusActions.push({
      label: 'Start',
      icon: <CheckIcon size={14} className="text-success-600" />,
      onClick: () => onStatusChange('active'),
    });
  }
  if (status === 'active') {
    statusActions.push({
      label: 'Pause',
      icon: <span className="w-3.5 h-3.5 flex items-center justify-center text-warning-600 font-bold text-xs">⏸</span>,
      onClick: () => onStatusChange('paused'),
    });
    statusActions.push({
      label: 'Stop',
      icon: <XIcon size={14} className="text-error-600" />,
      onClick: () => onStatusChange('completed'),
    });
  }
  if (status === 'paused') {
    statusActions.push({
      label: 'Resume',
      icon: <span className="w-3.5 h-3.5 flex items-center justify-center text-primary-600 font-bold text-xs">▶</span>,
      onClick: () => onStatusChange('active'),
    });
  }
  if (status !== 'archived') {
    statusActions.push({
      label: 'Archive',
      icon: <DownloadIcon size={14} className="text-neutral-500" />,
      onClick: () => onStatusChange('archived'),
    });
  }

  const allActions: Action[] = [
    { label: 'View Details', icon: <EyeIcon size={14} />, onClick: onView },
    { label: 'Edit', icon: <EditIcon size={14} />, onClick: onEdit },
    { label: 'Duplicate', icon: <span className="w-3.5 h-3.5 text-xs">⧉</span>, onClick: onDuplicate },
    ...(statusActions.length > 0
      ? [{ ...statusActions[0], divider: true }, ...statusActions.slice(1)]
      : []),
    {
      label: 'Delete',
      icon: <TrashIcon size={14} />,
      onClick: onDelete,
      variant: 'danger' as const,
      divider: true,
    },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
        aria-label="Campaign actions"
      >
        <MoreHorizontalIcon size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-neutral-200 rounded-xl shadow-lg py-1 min-w-[160px]">
          {allActions.map((action, i) => (
            <React.Fragment key={i}>
              {action.divider && i > 0 && <div className="my-1 border-t border-neutral-100" />}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                  action.variant === 'danger'
                    ? 'text-error-600 hover:bg-error-50'
                    : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <span className="w-4 flex items-center justify-center">{action.icon}</span>
                {action.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
