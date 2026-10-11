/**
 * PostCSS configuration for Tailwind CSS v4.
 * Tailwind v4 uses a dedicated PostCSS plugin package; there is no
 * `tailwind.config.js` — design tokens live in `src/app/globals.css`.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
