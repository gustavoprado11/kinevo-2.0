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
                sans: ['PlusJakartaSans_500Medium', 'system-ui', 'sans-serif'],
                'jakarta-regular': ['PlusJakartaSans_400Regular'],
                'jakarta-medium': ['PlusJakartaSans_500Medium'],
                'jakarta-semibold': ['PlusJakartaSans_600SemiBold'],
                'jakarta-bold': ['PlusJakartaSans_700Bold'],
                'jakarta-extrabold': ['PlusJakartaSans_800ExtraBold'],
            }
        },
    },
    plugins: [],
}
