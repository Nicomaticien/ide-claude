export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="16" fill="#12141A" />
      <path
        fill="#F08A3A"
        d="M48 16 A 18 18 0 1 0 48 48 L 48 40.5 A 10.5 10.5 0 1 1 48 23.5 Z"
      />
      <circle cx="48" cy="19.75" r="3.75" fill="#F08A3A" />
      <circle cx="48" cy="44.25" r="3.75" fill="#F08A3A" />
      <rect x="50.5" y="23" width="5.5" height="18" rx="2.75" fill="#FFE4C0" />
    </svg>
  );
}
