// Regenerates the Vesconte mark and the site icons from one geometry.
//
//   node scripts/build-brand-icons.mjs
//
// Outputs (commit them; nothing runs at build time):
//   design/brand/vesconte-mark.svg       reference master, light surfaces (navy)
//   design/brand/vesconte-mark-dark.svg  reference master, dark surfaces (white)
//   app/icon.svg                         browser tab icon, follows the OS colour scheme
//   app/favicon.ico                      16/32/48 fallback for browsers without SVG icons
//   app/apple-icon.png                   180x180 home-screen icon on an opaque surface
//
// The geometry was traced from the approved artwork (1254 px square) and
// re-centred on a 760 unit square. The masters keep the artwork's thin
// strokes. Tab icons render at 16-32 px, where those strokes disappear, so
// they use heavier strokes and nodes on the same centres and curves.
//
// sharp is not a direct dependency; it is installed with next.

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('..', import.meta.url))
const out = (path) => `${root}${path}`

const NAVY = '#091E3F'
const WHITE = '#FDFDFD'

const NODES = [
  [58, 101],
  [702, 101],
  [271.6, 431],
  [488.4, 431],
  [380, 661.5],
]

const EDGES = [
  'M58 101Q204 277 271.6 431',
  'M58 101C260.4 204.5 408.4 372.5 488.4 431',
  'M702 101Q556 277 488.4 431',
  'M702 101C499.6 204.5 351.6 372.5 271.6 431',
  'M271.6 431H488.4',
  'M271.6 431Q353.4 567 380 661.5',
  'M488.4 431Q406.6 567 380 661.5',
]

// Mark extent at stroke 0: x 58..702, y 101..661.5, centre (380, 381.25).
function viewBox(radius, margin) {
  const half = Math.max(322 + radius, 280.25 + radius) + margin
  const n = (v) => Math.round(v * 100) / 100
  return `${n(380 - half)} ${n(381.25 - half)} ${n(2 * half)} ${n(2 * half)}`
}

function shapes({ stroke, radius }, paint) {
  const edges = EDGES.map((d) => `<path d="${d}"/>`).join('')
  const nodes = NODES.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="${radius}"/>`).join('')
  return (
    `<g fill="none" stroke="${paint}" stroke-width="${stroke}" stroke-linecap="round">${edges}</g>` +
    `<g fill="${paint}">${nodes}</g>`
  )
}

function svg(weight, paint, { margin = 24, style = '', label = 'Vesconte' } = {}) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox(weight.radius, margin)}" role="img" aria-label="${label}">` +
    style +
    shapes(weight, paint) +
    '</svg>\n'
  )
}

const MASTER = { stroke: 7, radius: 33 }
const TAB = { stroke: 26, radius: 54 }
const TOUCH = { stroke: 14, radius: 40 }

const schemeStyle =
  `<style>svg{color:${NAVY}}@media (prefers-color-scheme:dark){svg{color:${WHITE}}}</style>`

async function png(markup, size) {
  return sharp(Buffer.from(markup), { density: 384 }).resize(size, size).png().toBuffer()
}

function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, data }, index) => {
    const entry = 6 + 16 * index
    header.writeUInt8(size >= 256 ? 0 : size, entry)
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(data.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += data.length
  })
  return Buffer.concat([header, ...images.map(({ data }) => data)])
}

await writeFile(out('design/brand/vesconte-mark.svg'), svg(MASTER, NAVY))
await writeFile(out('design/brand/vesconte-mark-dark.svg'), svg(MASTER, WHITE))
await writeFile(out('app/icon.svg'), svg(TAB, 'currentColor', { margin: 8, style: schemeStyle }))

// The .ico cannot follow the colour scheme; it keeps the primary navy mark.
const tabNavy = svg(TAB, NAVY, { margin: 8 })
const sizes = [16, 32, 48]
const frames = await Promise.all(sizes.map(async (size) => ({ size, data: await png(tabNavy, size) })))
await writeFile(out('app/favicon.ico'), ico(frames))

// iOS fills transparency with black, so the touch icon sits on white.
const touch = await sharp(await png(svg(TOUCH, NAVY, { margin: 0 }), 132))
  .extend({ top: 24, bottom: 24, left: 24, right: 24, background: '#FFFFFF' })
  .flatten({ background: '#FFFFFF' })
  .png()
  .toBuffer()
await writeFile(out('app/apple-icon.png'), touch)

console.log('wrote design/brand/vesconte-mark{,-dark}.svg, app/icon.svg, app/favicon.ico, app/apple-icon.png')
