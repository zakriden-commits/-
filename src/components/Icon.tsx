interface IconProps {
  name:
    | 'sound-on'
    | 'sound-off'
    | 'shield'
    | 'chart'
    | 'bolt'
    | 'play'
    | 'info'
    | 'dice'
    | 'calc'
    | 'target'
    | 'close';
  size?: number;
  strokeWidth?: number;
}

/** Минималистичные иконки в едином стиле — без зависимости от эмодзи-шрифтов */
export function Icon({ name, size = 18, strokeWidth = 1.6 }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'sound-on':
      return (
        <svg {...common}>
          <path d="M4 9.5h3.2L12 5.8v12.4L7.2 14.5H4z" fill="currentColor" stroke="none" />
          <path d="M15.5 9a4 4 0 0 1 0 6M18.2 6.6a7.6 7.6 0 0 1 0 10.8" />
        </svg>
      );
    case 'sound-off':
      return (
        <svg {...common}>
          <path d="M4 9.5h3.2L12 5.8v12.4L7.2 14.5H4z" fill="currentColor" stroke="none" />
          <path d="M16 9.5l5 5M21 9.5l-5 5" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3l7 3v5.4c0 4.3-2.9 7.6-7 9.6-4.1-2-7-5.3-7-9.6V6z" />
          <path d="M8.8 12l2.2 2.2 4.2-4.4" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h16" />
          <path d="M7 15l3.5-4.2 3 2.4L20 6.5" />
          <path d="M16 6.5h4v4" />
        </svg>
      );
    case 'bolt':
      return (
        <svg {...common}>
          <path d="M13.5 3L5.8 13.2h5l-1 7.8 8-10.6h-5.2z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'play':
      return (
        <svg {...common}>
          <path d="M8 5.5l10 6.5-10 6.5z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 11v5.5" />
          <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'dice':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="4" />
          <circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="15" cy="15" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="9" cy="15" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'calc':
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="3" />
          <path d="M8.5 7.5h7" />
          <path d="M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01" />
        </svg>
      );
    case 'target':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'close':
      return (
        <svg {...common}>
          <path d="M7 7l10 10M17 7L7 17" />
        </svg>
      );
    default:
      return null;
  }
}
