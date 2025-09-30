import { useEffect, useState } from "react";

// useMedia: returns whether a media query matches. Safe for SSR/tests.
export default function useMedia(query, initial = false) {
  const [matches, setMatches] = useState(initial);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);

    const handle = (e) => setMatches(!!e.matches);
    // initialize
    setMatches(!!mql.matches);

    if (mql.addEventListener) mql.addEventListener("change", handle);
    else if (mql.addListener) mql.addListener(handle);

    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handle);
      else if (mql.removeListener) mql.removeListener(handle);
    };
  }, [query]);

  return matches;
}
