import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.jsx',
    ],
    blocklist: ['[-:T]'],

    theme: {
        extend: {
            fontFamily: {
                sans: ['Figtree', ...defaultTheme.fontFamily.sans],
            },
        },
    },

    theme: {
        extend: {
            fontFamily: {
                sans: ['Figtree', ...defaultTheme.fontFamily.sans],
            },
            colors: {
                hunter: {
                    50: '#EEF3FA', 100: '#D6E0EF', 500: '#1E4E8C', 600: '#183F73',
                    700: '#12315F', 800: '#0E2A55', 900: '#0A1F44',
                },
                raspberry: { 500: '#E30B5C', 600: '#C81E51' },
                cool: { 100: '#F3F4F6' },
            },
        },
    },

    plugins: [forms],
};
