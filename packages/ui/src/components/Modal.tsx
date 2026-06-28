import React, { useEffect } from 'react';
import { cn } from '../cn';
import { XIcon } from '../icons';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnOverlay?: boolean;
  hideClose?: boolean;
}

const sizeStyles: Record<ModalSize, string> = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-xl',
  full: 'max-w-3xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  closeOnOverlay = true,
  hideClose = false,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-neutral-950/50 backdrop-blur-[2px] animate-fade-in"
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          'relative bg-white rounded-2xl shadow-2xl w-full',
          'animate-scale-in',
          sizeStyles[size],
        )}
      >
        {/* Header */}
        {(title || !hideClose) && (
          <div className="flex items-start justify-between px-6 pt-5 pb-0">
            <div>
              {title && (
                <h2
                  id="modal-title"
                  className="text-base font-bold text-neutral-900 tracking-tight"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-sm text-neutral-500 mt-1">{description}</p>
              )}
            </div>
            {!hideClose && (
              <button
                onClick={onClose}
                className="ml-4 -mr-1 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                aria-label="Close"
              >
                <XIcon size={18} />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 pb-5 pt-0 border-t border-neutral-100 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
