// The standalone worker is server code, but it runs outside React's resolver.
// Docker aliases the `server-only` marker to this empty module while bundling;
// the Next.js application keeps resolving the real package and its client guard.
export {};
