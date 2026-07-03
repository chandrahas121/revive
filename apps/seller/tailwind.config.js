/** @type {import('tailwindcss').Config} */
// Seller Central styles itself with inline styles + an injected stylesheet
// (see SELLER_CSS in SellerApp.jsx). Tailwind is included only for its preflight
// reset, matching how the seller rendered inside the consumer app previously.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: { extend: {} },
  plugins: [],
}
