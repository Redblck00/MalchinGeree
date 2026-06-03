// Next 16 App Router — built-in web app manifest (app/manifest.js)
// → /manifest.webmanifest дээр serve хийгдэнэ.
export default function manifest() {
  return {
    name: 'MalchinGeree',
    short_name: 'MalchinGeree',
    description: 'Малчны мал борлуулалтын цахим гэрээ',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#16a34a',
    icons: [
      { src: '/sheepIcon.png', sizes: '192x192', type: 'image/png' },
      { src: '/sheepIcon.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
