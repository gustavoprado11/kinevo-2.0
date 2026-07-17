/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,jsx,ts,tsx}",
        "./components/**/*.{js,jsx,ts,tsx}",
        "./hooks/**/*.{js,jsx,ts,tsx}"
    ],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                kinevo: {
                    background: '#0D0D17',
                    surface: '#1A1A2E'
                }
            },
            fontFamily: {
                sans: ['MonaSans_500Medium', 'system-ui', 'sans-serif'],
                'jakarta-regular': ['MonaSans_400Regular'],
                'jakarta-medium': ['MonaSans_500Medium'],
                'jakarta-semibold': ['MonaSans_600SemiBold'],
                'jakarta-bold': ['MonaSans_700Bold'],
                'jakarta-extrabold': ['MonaSans_800ExtraBold'],
            }
        },
    },
    plugins: [],
}
