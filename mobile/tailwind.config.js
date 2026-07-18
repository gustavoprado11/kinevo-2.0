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
                    background: '#111113',
                    surface: '#18181B'
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
