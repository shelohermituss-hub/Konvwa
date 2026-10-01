const vib = (pattern: number | number[]) => {
  if ('vibrate' in navigator) {
    try { navigator.vibrate(pattern) } catch {}
  }
}

export const haptics = {
  tap:     () => vib(8),
  nav:     () => vib(5),
  light:   () => vib(6),
  success: () => vib([8, 40, 8]),
  error:   () => vib(50),
  copy:    () => vib([5, 30, 5]),
}
