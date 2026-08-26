// Opt into the ocean before first paint. No interactive alternate layout
// exists; reduced motion is handled inside this same document.
try {
  document.body.classList.add("ocean");
} catch {
  // The static document remains readable without enhancement.
}
