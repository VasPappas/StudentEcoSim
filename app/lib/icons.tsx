import type { ReactNode } from "react";

function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const PlayIcon = () => <Icon><path d="M7 4.5v15l12-7.5z" fill="currentColor" /></Icon>;
export const PauseIcon = () => <Icon><path d="M8 5v14M16 5v14" strokeWidth="3" /></Icon>;
export const StepIcon = () => <Icon><path d="M6 5v14l10-7z" fill="currentColor" /><path d="M19 5v14" /></Icon>;
export const RestartIcon = () => <Icon><path d="M4 12a8 8 0 1 0 2.6-5.9" /><path d="M4 4v5h5" /></Icon>;
export const SunIcon = () => (
  <Icon><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>
);
export const MoonIcon = () => <Icon><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></Icon>;
export const CheckIcon = () => <Icon><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>;
export const CrossIcon = () => <Icon><path d="M6 6l12 12M18 6L6 18" /></Icon>;
export const DiceIcon = () => (
  <Icon><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1" fill="currentColor" /><circle cx="15" cy="15" r="1" fill="currentColor" /><circle cx="15" cy="9" r="1" fill="currentColor" /><circle cx="9" cy="15" r="1" fill="currentColor" /></Icon>
);
