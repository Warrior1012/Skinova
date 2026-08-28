/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: { colors: { brand: '#4F8F5B', ink: '#172019', soft: '#F6F8F5' }, boxShadow: { soft: '0 18px 50px rgba(23,32,25,.08)' } } },
  plugins: []
}
