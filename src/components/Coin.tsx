export function Coin({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="coin">
      <defs>
        <linearGradient id="coin-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3bf" />
          <stop offset="0.5" stopColor="#f2c14e" />
          <stop offset="1" stopColor="#a8721a" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="url(#coin-a)" />
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="#8a5c10" strokeOpacity="0.55" strokeWidth="1.4" />
      <path d="M16 8.5l2.2 4.6 5 .7-3.6 3.6.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.6 5-.7z" fill="#8a5c10" opacity="0.75" />
      <ellipse cx="11" cy="10.5" rx="2.4" ry="1.4" fill="#fff" opacity="0.5" transform="rotate(-30 11 10.5)" />
    </svg>
  );
}
