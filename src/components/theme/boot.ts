// Shared by the server layout and the client ThemeProvider (plain module, not "use client",
// so the server can read the real string values).
export const THEME_KEY = "vp.theme";
export const THEME_QUERY = "(prefers-color-scheme: dark)";

/** Runs in <head> before the first paint so the page never flashes the wrong theme. */
export const THEME_BOOT_SCRIPT = `try{var p=localStorage.getItem("${THEME_KEY}");var d=p==="dark"||(p!=="light"&&window.matchMedia("${THEME_QUERY}").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light";}catch(e){}`;

