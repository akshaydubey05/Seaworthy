export function SeaworthyMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
      <path
        d="M4 14.5C5.8 13 7.5 13 9.3 14.5C11.1 16 12.9 16 14.7 14.5C16.5 13 18.2 13 20 14.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 18C5.8 16.5 7.5 16.5 9.3 18C11.1 19.5 12.9 19.5 14.7 18C16.5 16.5 18.2 16.5 20 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.72"
      />
      <path
        d="M12 4.5L12 11.5M12 4.5L9.5 7M12 4.5L14.5 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}