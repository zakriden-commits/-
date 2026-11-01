import type { CSSProperties } from 'react';

interface SymbolIconProps {
  art: string;
  label?: string;
  className?: string;
  glow?: string;
  style?: CSSProperties;
}

const GOLD = ['#fff8d8', '#f7d27a', '#b07a25'] as const;

function Gem({ colors, id }: { colors: [string, string, string]; id: string }) {
  return (
    <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor={colors[0]} />
          <stop offset="0.55" stopColor={colors[1]} />
          <stop offset="1" stopColor={colors[2]} />
        </linearGradient>
      </defs>
      <polygon points="32,4 56,24 32,60 8,24" fill={`url(#${id}-g)`} />
      <polygon points="32,4 42,24 32,60 22,24" fill="#ffffff" opacity="0.22" />
      <polygon points="8,24 56,24 32,36" fill="#ffffff" opacity="0.16" />
      <polygon points="32,4 56,24 32,60 8,24" fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="1.4" />
      <polyline points="8,24 32,36 56,24" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.2" />
      <polyline points="22,24 32,4 42,24 32,36 22,24" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" />
    </svg>
  );
}

export function SymbolIcon({ art, label, className, glow, style }: SymbolIconProps) {
  const wrap = (children: React.ReactNode) => (
    <span
      className={`sym ${className ?? ''}`}
      style={{ ...(glow ? ({ '--sym-glow': glow } as CSSProperties) : {}), ...style }}
    >
      {children}
    </span>
  );

  switch (art) {
    case 'card': {
      const rank = label ?? 'A';
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <defs>
            <linearGradient id="sym-card" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={GOLD[0]} />
              <stop offset="0.5" stopColor={GOLD[1]} />
              <stop offset="1" stopColor={GOLD[2]} />
            </linearGradient>
          </defs>
          <rect x="8.5" y="6.5" width="47" height="51" rx="9" fill="#05040a" opacity="0.55" />
          <rect x="8.5" y="6.5" width="47" height="51" rx="9" fill="none" stroke="url(#sym-card)" strokeWidth="1.6" opacity="0.9" />
          <rect x="12.5" y="10.5" width="39" height="43" rx="6" fill="none" stroke="#ffffff" strokeOpacity="0.12" />
          <text
            x="32"
            y="44"
            textAnchor="middle"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize={rank.length > 1 ? 29 : 33}
            fontWeight="700"
            fill="url(#sym-card)"
          >
            {rank}
          </text>
          <path d="M32 49.5l2.6 2.6-2.6 2.6-2.6-2.6z" fill={GOLD[1]} opacity="0.85" />
        </svg>,
      );
    }
    case 'diamond':
      return wrap(<Gem colors={['#ffffff', '#9be7ff', '#2b7fb8']} id="gem-diamond" />);
    case 'sapphire':
      return wrap(<Gem colors={['#dbe6ff', '#7b9cff', '#243a9c']} id="gem-sapphire" />);
    case 'emerald':
      return wrap(<Gem colors={['#d8ffe9', '#4ade80', '#10673c']} id="gem-emerald" />);
    case 'ruby':
      return wrap(<Gem colors={['#ffd9e2', '#ff5f7e', '#8c1030']} id="gem-ruby" />);
    case 'cherry':
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <defs>
            <radialGradient id="sym-cherry" cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#ff8d8d" />
              <stop offset="0.45" stopColor="#e4223c" />
              <stop offset="1" stopColor="#7a0a1c" />
            </radialGradient>
          </defs>
          <path d="M24 34c1-11 6-17 12-21" stroke="#57c07a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M40 38c-1-8-1-16-4-25" stroke="#57c07a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M36 13c6-5 14-4 17 1-5 4-13 5-17-1z" fill="#6ee7a0" />
          <path d="M24 34c1-10 5-16 10-20" stroke="#a7f3c0" strokeWidth="1" fill="none" opacity="0.6" />
          <circle cx="23" cy="45" r="11" fill="url(#sym-cherry)" />
          <circle cx="42" cy="48" r="9.5" fill="url(#sym-cherry)" />
          <ellipse cx="19" cy="41" rx="3.4" ry="2.2" fill="#fff" opacity="0.55" transform="rotate(-25 19 41)" />
          <ellipse cx="39" cy="45" rx="2.6" ry="1.7" fill="#fff" opacity="0.45" transform="rotate(-25 39 45)" />
        </svg>,
      );
    case 'lemon':
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <defs>
            <linearGradient id="sym-lemon" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff7a8" />
              <stop offset="0.5" stopColor="#ffd93d" />
              <stop offset="1" stopColor="#c08a06" />
            </linearGradient>
          </defs>
          <path d="M12 40c-4-14 12-26 26-22s18 20 6 28-28 8-32-6z" fill="url(#sym-lemon)" />
          <path d="M12 40c-2-7 1-13 6-17" stroke="#fff6bf" strokeWidth="2.5" fill="none" opacity="0.7" strokeLinecap="round" />
          <path d="M48 16c5-3 10 0 11 4-4 2-9 1-11-4z" fill="#7ad98f" />
          <ellipse cx="27" cy="33" rx="4" ry="2.4" fill="#fff" opacity="0.5" transform="rotate(-30 27 33)" />
        </svg>,
      );
    case 'plum':
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <defs>
            <radialGradient id="sym-plum" cx="0.35" cy="0.3" r="0.85">
              <stop offset="0" stopColor="#e3b5ff" />
              <stop offset="0.45" stopColor="#a855f7" />
              <stop offset="1" stopColor="#4c1d95" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="38" r="18" fill="url(#sym-plum)" />
          <path d="M32 20c0-6 3-10 8-12" stroke="#7c4d2a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M35 15c6-6 15-5 18 0-6 5-14 6-18 0z" fill="#6ee7a0" />
          <path d="M32 22c-2 10-2 20 2 30" stroke="#f5d0fe" strokeWidth="1.6" fill="none" opacity="0.45" />
          <ellipse cx="25" cy="31" rx="4.2" ry="2.6" fill="#fff" opacity="0.42" transform="rotate(-30 25 31)" />
        </svg>,
      );
    case 'melon':
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <defs>
            <linearGradient id="sym-melon" x1="0" y1="0" x2="0.7" y2="1">
              <stop offset="0" stopColor="#ff9aa6" />
              <stop offset="0.6" stopColor="#ef2d4f" />
              <stop offset="1" stopColor="#a30f2c" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="34" r="22" fill="#1f7a3d" />
          <circle cx="32" cy="34" r="18.5" fill="#f3f7d9" />
          <circle cx="32" cy="34" r="16" fill="url(#sym-melon)" />
          <ellipse cx="25" cy="26" rx="3.4" ry="2.2" fill="#fff" opacity="0.4" transform="rotate(-30 25 26)" />
          <g fill="#2b1a12">
            <ellipse cx="25" cy="32" rx="1.6" ry="2.4" transform="rotate(-20 25 32)" />
            <ellipse cx="33" cy="27" rx="1.6" ry="2.4" transform="rotate(-20 33 27)" />
            <ellipse cx="39" cy="36" rx="1.6" ry="2.4" transform="rotate(-20 39 36)" />
            <ellipse cx="31" cy="42" rx="1.6" ry="2.4" transform="rotate(-20 31 42)" />
            <ellipse cx="23" cy="42" rx="1.6" ry="2.4" transform="rotate(-20 23 42)" />
          </g>
        </svg>,
      );
    case 'bell':
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <defs>
            <linearGradient id="sym-bell" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff4c2" />
              <stop offset="0.45" stopColor="#f2c14e" />
              <stop offset="1" stopColor="#a8711a" />
            </linearGradient>
          </defs>
          <path d="M32 8v5" stroke="#f2c14e" strokeWidth="3" strokeLinecap="round" />
          <circle cx="32" cy="8" r="3.4" fill="#fff2be" />
          <path d="M32 13c-8 0-12 7-13 15-1 7-2 11-6 15-1 2 0 4 2 4h34c2 0 3-2 2-4-4-4-5-8-6-15-1-8-5-15-13-15z" fill="url(#sym-bell)" />
          <path d="M14 47h36" stroke="#8a5a12" strokeWidth="1.4" opacity="0.5" />
          <path d="M24 17c-4 4-6 10-6 17" stroke="#fff8dc" strokeWidth="2.4" fill="none" opacity="0.6" strokeLinecap="round" />
          <circle cx="32" cy="51" r="4.6" fill="#c8912a" />
          <circle cx="32" cy="51" r="2.6" fill="#ffe9a8" />
        </svg>,
      );
    case 'seven':
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <defs>
            <linearGradient id="sym-seven" x1="0" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor="#ffd0f4" />
              <stop offset="0.45" stopColor="#ff5fd2" />
              <stop offset="1" stopColor="#8b1a6b" />
            </linearGradient>
          </defs>
          <text
            x="32"
            y="50"
            textAnchor="middle"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize="48"
            fontWeight="700"
            fontStyle="italic"
            fill="url(#sym-seven)"
            stroke="#3c0729"
            strokeWidth="2"
            paintOrder="stroke"
          >
            7
          </text>
          <path d="M22 22h22" stroke="#ffd0f4" strokeWidth="2" opacity="0.5" strokeLinecap="round" />
        </svg>,
      );
    case 'snowflake':
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <g stroke="#d9f6ff" strokeWidth="3" strokeLinecap="round">
            <path d="M32 6v52" />
            <path d="M9.5 19l45 26" />
            <path d="M54.5 19l-45 26" />
          </g>
          <g stroke="#7fe9ff" strokeWidth="2" strokeLinecap="round">
            <path d="M32 14l-6-6M32 14l6-6M32 50l-6 6M32 50l6 6" />
            <path d="M14 24l-2-8M14 24l8 1M50 40l2 8M50 40l-8-1" />
            <path d="M50 24l2-8M50 24l-8 1M14 40l-2 8M14 40l8-1" />
          </g>
          <circle cx="32" cy="32" r="5" fill="#eafcff" />
          <circle cx="32" cy="32" r="2.4" fill="#7fe9ff" />
        </svg>,
      );
    case 'scarab':
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <defs>
            <linearGradient id="sym-scarab" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#b6ffd6" />
              <stop offset="0.5" stopColor="#2fbf7a" />
              <stop offset="1" stopColor="#0a5c3c" />
            </linearGradient>
          </defs>
          <g stroke="#bfe9c9" strokeWidth="2.2" strokeLinecap="round" opacity="0.9">
            <path d="M18 26l-9-6M18 34H6M18 42l-9 6M46 26l9-6M46 34h12M46 42l9 6" />
          </g>
          <ellipse cx="32" cy="38" rx="13" ry="16" fill="url(#sym-scarab)" />
          <path d="M32 23v30" stroke="#063e28" strokeWidth="1.6" opacity="0.7" />
          <path d="M20 33c-3 6-3 12 0 17M44 33c3 6 3 12 0 17" stroke="#eafff2" strokeWidth="1.4" fill="none" opacity="0.5" />
          <ellipse cx="32" cy="20" rx="8" ry="6" fill="url(#sym-scarab)" />
          <path d="M27 14c1-4 4-6 5-6s4 2 5 6" stroke="#ffd76e" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <circle cx="32" cy="36" r="4.6" fill="#ffd76e" opacity="0.9" />
          <path d="M32 32l1.4 2.6 2.9.4-2.1 2 .5 2.9-2.7-1.4-2.7 1.4.5-2.9-2.1-2 2.9-.4z" fill="#0a5c3c" />
        </svg>,
      );
    case 'ankh':
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <defs>
            <linearGradient id="sym-ankh" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffeeb0" />
              <stop offset="0.5" stopColor="#f0c060" />
              <stop offset="1" stopColor="#95651b" />
            </linearGradient>
          </defs>
          <path
            d="M32 22c-4 0-7-4-7-8s3-7 7-7 7 3 7 7-3 8-7 8zm0 0v34M20 30h24"
            fill="none"
            stroke="url(#sym-ankh)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path d="M32 14c-2 0-3.4 2-3.4 4.2" stroke="#fffbe6" strokeWidth="1.6" fill="none" opacity="0.7" />
          <path d="M23 27h18" stroke="#7fe9ff" strokeWidth="1.6" opacity="0.75" />
        </svg>,
      );
    case 'eye':
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <defs>
            <linearGradient id="sym-eye" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff2bd" />
              <stop offset="0.5" stopColor="#f3c85e" />
              <stop offset="1" stopColor="#9a6a1c" />
            </linearGradient>
          </defs>
          <path d="M10 34c8-9 15-13 22-13s14 4 22 13c-8 9-15 13-22 13s-14-4-22-13z" fill="#0d1526" stroke="url(#sym-eye)" strokeWidth="2.6" />
          <circle cx="32" cy="34" r="8.5" fill="url(#sym-eye)" />
          <circle cx="32" cy="34" r="4" fill="#0b3d4a" />
          <circle cx="32" cy="34" r="2" fill="#041014" />
          <circle cx="35" cy="31" r="1.6" fill="#ffffff" opacity="0.8" />
          <path d="M18 18c9-5 19-5 28 0" stroke="#f3c85e" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M46 48c3 2 4 5 3 8" stroke="#f3c85e" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </svg>,
      );
    case 'pharaoh':
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <defs>
            <linearGradient id="sym-ph" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffe9a8" />
              <stop offset="0.5" stopColor="#e6b455" />
              <stop offset="1" stopColor="#8a5a16" />
            </linearGradient>
            <linearGradient id="sym-ph-blue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3f8fd8" />
              <stop offset="1" stopColor="#123a63" />
            </linearGradient>
          </defs>
          <path d="M12 26c0-10 9-18 20-18s20 8 20 18v14c0 6-4 10-9 12H21c-5-2-9-6-9-12z" fill="url(#sym-ph-blue)" />
          <g stroke="#f0c060" strokeWidth="1.6" opacity="0.85">
            <path d="M16 20h32M14 26h36M14 32h36M15 38h34M18 44h28" />
          </g>
          <path d="M24 24c0-6 3.6-10 8-10s8 4 8 10v16c0 6-3.6 10-8 12-4.4-2-8-6-8-12z" fill="url(#sym-ph)" />
          <path d="M26 30c2-1.4 4-1.4 6 0M34 30c2-1.4 4-1.4 6 0" stroke="#3b2206" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M29 38h6l-3 3z" fill="#3b2206" />
          <path d="M32 43v8" stroke="#3b2206" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M27 45h10" stroke="#3b2206" strokeWidth="2.4" strokeLinecap="round" />
        </svg>,
      );
    case 'coin':
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <defs>
            <linearGradient id="sym-coin" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff6c9" />
              <stop offset="0.45" stopColor="#f6c949" />
              <stop offset="1" stopColor="#9d6a12" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="34" r="23" fill="url(#sym-coin)" />
          <circle cx="32" cy="34" r="18" fill="none" stroke="#8a5c10" strokeWidth="1.6" opacity="0.7" />
          <circle cx="32" cy="34" r="23" fill="none" stroke="#fff2b8" strokeWidth="1.4" opacity="0.6" />
          <path d="M32 20l3.6 7.6 8.4 1.1-6.1 5.8 1.5 8.3-7.4-4-7.4 4 1.5-8.3-6.1-5.8 8.4-1.1z" fill="#8a5c10" opacity="0.85" />
          <ellipse cx="24" cy="24" rx="4" ry="2.4" fill="#fff" opacity="0.5" transform="rotate(-30 24 24)" />
        </svg>,
      );
    case 'ingot':
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <defs>
            <linearGradient id="sym-ingot" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff3b8" />
              <stop offset="0.5" stopColor="#f2c14e" />
              <stop offset="1" stopColor="#a06f16" />
            </linearGradient>
          </defs>
          <path d="M18 22h28l8 22H10z" fill="url(#sym-ingot)" />
          <path d="M18 22h28l2 5H16z" fill="#fff6c8" opacity="0.75" />
          <path d="M24 30h16l4 10H20z" fill="#8a5c10" opacity="0.35" />
          <path d="M12 44h40" stroke="#6d4a0d" strokeWidth="2" opacity="0.6" />
          <path d="M22 26l-4 14" stroke="#fffbe2" strokeWidth="2" opacity="0.45" />
        </svg>,
      );
    case 'lantern':
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <defs>
            <linearGradient id="sym-lantern" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ff8a5b" />
              <stop offset="0.5" stopColor="#e01f2d" />
              <stop offset="1" stopColor="#7d0a14" />
            </linearGradient>
          </defs>
          <path d="M32 4v6" stroke="#ffd166" strokeWidth="2" strokeLinecap="round" />
          <rect x="20" y="10" width="24" height="6" rx="2" fill="#f2c14e" />
          <rect x="18" y="16" width="28" height="32" rx="12" fill="url(#sym-lantern)" />
          <path d="M26 18v28M32 16v32M38 18v28" stroke="#ffd166" strokeWidth="1.4" opacity="0.55" />
          <rect x="20" y="47" width="24" height="6" rx="2" fill="#f2c14e" />
          <path d="M32 53v5l-4 4M32 58l4 4" stroke="#ffd166" strokeWidth="2" fill="none" strokeLinecap="round" />
          <ellipse cx="27" cy="28" rx="3" ry="5" fill="#ffb199" opacity="0.35" />
        </svg>,
      );
    case 'dragon':
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <defs>
            <linearGradient id="sym-dragon" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff8a5b" />
              <stop offset="0.5" stopColor="#e2232f" />
              <stop offset="1" stopColor="#6e0a12" />
            </linearGradient>
          </defs>
          <path d="M14 18c-3-6-2-11 1-13 2 4 5 7 9 8M50 18c3-6 2-11-1-13-2 4-5 7-9 8" fill="#f2c14e" />
          <path d="M32 10c11 0 19 9 19 20 0 8-3 12-6 16l-5 12H24l-5-12c-3-4-6-8-6-16 0-11 8-20 19-20z" fill="url(#sym-dragon)" />
          <path d="M18 24c-5 1-8 4-9 8 4 0 8-2 11-4M46 24c5 1 8 4 9 8-4 0-8-2-11-4" fill="#f2c14e" opacity="0.9" />
          <circle cx="25" cy="26" r="4" fill="#ffe9a8" />
          <circle cx="39" cy="26" r="4" fill="#ffe9a8" />
          <circle cx="26" cy="26" r="1.8" fill="#25040a" />
          <circle cx="40" cy="26" r="1.8" fill="#25040a" />
          <path d="M24 38c3 2 5 2 8 0 3 2 5 2 8 0" stroke="#ffd166" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M28 42l-2 6M36 42l2 6" stroke="#ffd166" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M20 34c-2 2-2 5 0 7M44 34c2 2 2 5 0 7" stroke="#ffb199" strokeWidth="1.4" fill="none" opacity="0.6" />
        </svg>,
      );
    case 'wild':
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <defs>
            <linearGradient id="sym-wild" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff7cf" />
              <stop offset="0.5" stopColor="#f5c95a" />
              <stop offset="1" stopColor="#9a6714" />
            </linearGradient>
          </defs>
          <path d="M32 4l6 8 9-3 1 10 9 4-5 8 5 8-9 4-1 10-9-3-6 8-6-8-9 3-1-10-9-4 5-8-5-8 9-4 1-10 9 3z" fill="url(#sym-wild)" opacity="0.22" />
          <circle cx="32" cy="34" r="21" fill="#0d0a06" opacity="0.5" />
          <circle cx="32" cy="34" r="21" fill="none" stroke="url(#sym-wild)" strokeWidth="2.4" />
          <text x="32" y="39" textAnchor="middle" fontFamily="Georgia, serif" fontSize="15" fontWeight="700" fill="url(#sym-wild)" letterSpacing="0.5">
            WILD
          </text>
          <path d="M20 44h24" stroke="#f5c95a" strokeWidth="1.4" opacity="0.6" />
        </svg>,
      );
    case 'scatter':
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <defs>
            <linearGradient id="sym-scatter" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff0c2" />
              <stop offset="0.5" stopColor="#f2a03d" />
              <stop offset="1" stopColor="#9c3d0d" />
            </linearGradient>
          </defs>
          <g stroke="#ffcf7a" strokeWidth="2" strokeLinecap="round" opacity="0.9">
            <path d="M32 2v8M32 54v8M2 32h8M54 32h8M11 11l6 6M47 47l6 6M53 11l-6 6M17 47l-6 6" />
          </g>
          <circle cx="32" cy="32" r="19" fill="url(#sym-scatter)" />
          <circle cx="32" cy="32" r="14" fill="none" stroke="#7a2c05" strokeWidth="1.6" opacity="0.7" />
          <path d="M32 20l3 8h8l-6.5 5 2.5 8-7-5-7 5 2.5-8L21 28h8z" fill="#7a2c05" opacity="0.85" />
        </svg>,
      );
    default:
      return wrap(
        <svg viewBox="0 0 64 64" className="sym-svg" aria-hidden>
          <circle cx="32" cy="32" r="20" fill="none" stroke="#f5c95a" strokeWidth="3" />
        </svg>,
      );
  }
}
