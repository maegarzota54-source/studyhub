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
                    50: '#eef4ef', 100: '#d6e5d9', 500: '#4a7c52', 600: '#3f6a46',
                    700: '#355E3B', 800: '#2a4a2f', 900: '#1d3321',
                },
                raspberry: { 500: '#E30B5C', 600: '#C81E51' },
                cool: { 100: '#F3F4F6' },
            },
        },
    },

    plugins: [forms],
};
