type IconProps = { size?: number; className?: string };

export function CheckIcon({ size = 13, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path
        d="M4.5 12.6l5 5 10-11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FlagIcon({ size = 13, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path
        d="M5 3v18M5 4h13l-3 4 3 4H5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ShareIcon({ size = 14, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path
        d="M12 15V4m0 0L8 8m4-4l4 4M5 14v4a2 2 0 002 2h10a2 2 0 002-2v-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchIcon({ size = 16, className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" fill="none" strokeWidth="2" stroke="currentColor" />
      <line
        x1="12.6"
        y1="12.6"
        x2="17.5"
        y2="17.5"
        strokeWidth="2"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 並び替えの握り。指で取れる大きさが要るので、当たり判定は親側で確保する */
export function GripIcon({ size = 15, className }: IconProps) {
  return (
    <svg viewBox="0 0 18 18" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="6" cy="4" r="1.4" />
      <circle cx="12" cy="4" r="1.4" />
      <circle cx="6" cy="9" r="1.4" />
      <circle cx="12" cy="9" r="1.4" />
      <circle cx="6" cy="14" r="1.4" />
      <circle cx="12" cy="14" r="1.4" />
    </svg>
  );
}
