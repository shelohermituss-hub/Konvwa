// Applies the saved theme before the first paint (no light flash in dark mode). Same key as ThemeProvider in main.tsx.
(function () {
  try {
    var saved = localStorage.getItem('haiti-import-theme') || 'light'
    var dark = saved === 'dark' || (saved === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    var root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(dark ? 'dark' : 'light')
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', dark ? '#0b1220' : '#FFFFFF')
  } catch (e) { /* storage blocked: stay light */ }
})()
