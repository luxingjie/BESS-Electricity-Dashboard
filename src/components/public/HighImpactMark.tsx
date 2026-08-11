/** Compact high-impact badge used on public policy surfaces. */

export function HighImpactMark({
  className,
  withLabel = false,
}: {
  className?: string;
  /** Show short international label next to the icon. */
  withLabel?: boolean;
}) {
  return (
    <span
      className={className}
      title="Key policy · ranked by the system"
      aria-label="Key policy"
    >
      <svg
        className="gl-high-impact-icon"
        viewBox="0 0 16 16"
        width="12"
        height="12"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M8 1.2l1.76 3.56 3.93.57-2.84 2.77.67 3.91L8 10.16l-3.52 1.85.67-3.91L2.31 5.33l3.93-.57L8 1.2z"
        />
      </svg>
      {withLabel ? <span className="gl-high-impact-label">Key</span> : null}
    </span>
  );
}

/** Strip legacy （***） / (***) title prefixes from display. */
export function stripLegacyImpactPrefix(title: string | null | undefined): string {
  if (!title) return "";
  return title.replace(/^[（(]\*\*\*[）)]\s*/, "").trimStart();
}
