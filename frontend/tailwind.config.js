/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#FAF6ED',
        primary: '#7B61FF',
        accent1: '#FF6FB5',
        accent2: '#3DA35D',
        accent3: '#FF7A33',
        status: {
          success: '#3DA35D',
          running: '#FFC107',
          failed: '#EF4444',
          queued: '#9CA3AF',
          paused: '#FF6FB5'
        }
      },
      boxShadow: {
        'brutal': '4px 4px 0px 0px rgba(0,0,0,1)',
        'brutal-sm': '2px 2px 0px 0px rgba(0,0,0,1)',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
      },
      borderRadius: {
        'brutal': '4px',
      }
    },
  },
  plugins: [],
}
