// the two controls that sit on a pressed piece. drawn rather than typed, so
// they share one stroke weight with each other and with nothing else
export function LiftIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8" />
    </svg>
  )
}

export function ResizeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 3.5h3v3M6.5 12.5h-3v-3M12.5 3.5 9 7M3.5 12.5 7 9" />
    </svg>
  )
}
