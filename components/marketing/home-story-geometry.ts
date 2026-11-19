export const ORBIT_CENTRE = { x: 340, y: 247 }
export const ORBIT_COLOURS = ['#9aa839', '#40ae8b', '#b36ec5', '#c8795b']
export const ORBIT_NODES = [
  { x: 205, y: 123, region: 0 }, { x: 271, y: 79, region: 0 },
  { x: 340, y: 65, region: 0 }, { x: 405, y: 81, region: 0 },
  { x: 475, y: 123, region: 0 }, { x: 523, y: 192, region: 1 },
  { x: 548, y: 263, region: 1 }, { x: 488, y: 347, region: 1 },
  { x: 247, y: 404, region: 2 }, { x: 154, y: 263, region: 3 },
  { x: 161, y: 191, region: 3 },
]

export const ATLAS_WIDTH = 960
export const ATLAS_HEIGHT = 730

type Point = { x: number; y: number }
type Island = {
  centre: Point
  outline: Point[]
  path: string
  count: number
}
type AtlasDot = Point & { radius: number }
// x, y, half-width, half-height, clockwise rotation, points, optional traced shore
type Landform = [number, number, number, number, number, number, Point[]?]
type Region = { name: string; colour: string; yOffset: number; label?: Point; land: Landform[] }

const SEMICONDUCTOR_SHORE = [
  [470, 156], [493, 176], [487, 195], [449, 211], [420, 199], [384, 212],
  [376, 237], [351, 251], [318, 245], [302, 223], [274, 211], [234, 221],
  [205, 203], [172, 193], [182, 176], [226, 162], [244, 146], [241, 126],
  [270, 116], [298, 129], [320, 150], [349, 156], [391, 131], [408, 109],
  [443, 108], [465, 128], [454, 144],
].map(([x, y]) => ({ x, y }))

const REGIONS: Region[] = [
  { name: 'Materials', colour: '#91a8c5', yOffset: 12, land: [[78, 91, 34, 25, -0.67, 6], [28, 121, 11, 6, 0.4, 1], [57, 139, 7, 5, 0, 0]] },
  { name: 'Industry', colour: '#c789ad', label: { x: 198, y: 337 }, yOffset: 133, land: [[197, 335, 115, 40, -0.46, 17], [98, 378, 21, 10, -0.3, 2], [39, 385, 17, 8, 0.1, 1], [81, 316, 11, 6, 0, 0]] },
  { name: 'Semiconductors', colour: '#63b6a2', label: { x: 317, y: 191 }, yOffset: 49, land: [[325, 192, 1, 1, 0, 27, SEMICONDUCTOR_SHORE], [380, 70, 27, 9, 0.4, 2], [161, 249, 24, 12, 0.15, 2], [473, 253, 11, 6, -0.2, 1]] },
  { name: 'Cloud', colour: '#a797d7', label: { x: 617, y: 76 }, yOffset: 0, land: [[610, 73, 76, 22, -0.38, 10], [690, 95, 22, 10, 0.41, 2], [658, 28, 9, 6, -0.3, 1], [731, 69, 8, 5, 0.5, 0]] },
  { name: 'Energy', colour: '#bbae6a', label: { x: 845, y: 157 }, yOffset: 52, land: [[844, 150, 76, 35, 0.4, 11], [916, 198, 25, 8, 0.34, 2], [782, 91, 15, 8, -0.56, 1]] },
  { name: 'Renewables', colour: '#73b4cb', label: { x: 755, y: 337 }, yOffset: 147, land: [[753, 331, 101, 49, -0.44, 19], [640, 378, 31, 11, -0.42, 3], [814, 261, 23, 8, -0.34, 1], [893, 287, 19, 7, 0.32, 1], [895, 387, 7, 4, 0.2, 0]] },
  { name: 'Banks', colour: '#a29ab8', yOffset: 97, land: [[542, 317, 39, 18, -0.15, 6], [574, 340, 13, 7, 0.12, 1]] },
  { name: 'Consumer', colour: '#c69874', label: { x: 326, y: 420 }, yOffset: 206, land: [[329, 424, 59, 26, 0.43, 8], [390, 450, 20, 10, 0.52, 2], [272, 468, 12, 7, 0.12, 1]] },
  { name: 'Biotech', colour: '#ba9484', yOffset: 199, land: [[497, 457, 40, 16, -0.32, 6], [558, 414, 14, 7, 0.42, 1]] },
  { name: 'Transport', colour: '#8f9fb6', yOffset: 223, land: [[914, 448, 26, 14, -0.3, 5], [865, 471, 10, 5, 0.24, 1]] },
]

function fraction(value: number) {
  return value - Math.floor(value)
}

function midpoint(a: Point, b: Point) {
  return `${((a.x + b.x) / 2).toFixed(1)} ${((a.y + b.y) / 2).toFixed(1)}`
}

function coastline(outline: Point[]) {
  return `M${midpoint(outline.at(-1)!, outline[0])}` + outline.map((point, index) =>
    `Q${point.x.toFixed(1)} ${point.y.toFixed(1)} ${midpoint(point, outline[(index + 1) % outline.length])}`
  ).join('') + 'Z'
}

function makeIsland([x, baseY, width, height, rotation, count, shore]: Landform, phase: number, yOffset: number): Island {
  const y = baseY + yOffset
  const size = count < 3 ? 10 : 34
  const outline = shore?.map(({ x, y }) => ({ x, y: y + yOffset })) ?? Array.from({ length: size }, (_, index) => {
    const angle = index / size * 2 * Math.PI
    const ripple = 1 + 0.18 * Math.cos(angle + phase)
      + 0.18 * Math.sin(3 * angle + phase * 1.3)
      + 0.10 * Math.cos(5 * angle - phase * 1.7)
      + 0.045 * Math.sin(9 * angle + phase * 0.8)
    const u = Math.cos(angle) * width * ripple
    const v = Math.sin(angle) * height * ripple
    return {
      x: x + u * Math.cos(rotation) - v * Math.sin(rotation),
      y: y + u * Math.sin(rotation) + v * Math.cos(rotation),
    }
  })
  return { centre: { x, y }, outline, path: coastline(outline), count }
}

function scatter(index: number, phase: number) {
  return fraction(Math.sin((index + 1) * 17.133 + phase * 83.41) * 43758.5453)
}

function islandDots({ centre, outline, count }: Island, phase: number): AtlasDot[] {
  return Array.from({ length: count }, (_, index) => {
    const edge = scatter(index, phase) * outline.length
    const floor = Math.floor(edge)
    const a = outline[floor], b = outline[(floor + 1) % outline.length]
    const t = edge - floor
    const reach = count === 1 ? 0 : 0.16 + 0.64 * Math.sqrt(scatter(index, phase + 1.9))
    return {
      x: centre.x + (a.x + (b.x - a.x) * t - centre.x) * reach,
      y: centre.y + (a.y + (b.y - a.y) * t - centre.y) * reach,
      radius: 1.4 + scatter(index, phase + 2.7) * 1.8,
    }
  })
}

function distance(from: Point, to: Point) {
  return (from.x - to.x) ** 2 + (from.y - to.y) ** 2
}

function regionEdges(dots: AtlasDot[]) {
  const taken = new Set<string>()
  return dots.flatMap((from, index) => dots.map((to, toIndex) => ({ to, toIndex }))
    .filter(({ toIndex }) => toIndex !== index)
    .sort((a, b) => distance(from, a.to) - distance(from, b.to))
    .slice(0, index % 3 === 0 ? 2 : 1)
    .flatMap(({ to, toIndex }) => {
      const id = `${Math.min(index, toIndex)}-${Math.max(index, toIndex)}`
      if (taken.has(id)) return []
      taken.add(id)
      return [{ id, from, to }]
    }))
}

export const ATLAS_CLUSTERS = REGIONS.map(({ land, label, yOffset, ...region }, index) => {
  const islands = land.map((shape, order) => makeIsland(shape, index * 1.38 + order * 0.81, yOffset))
  const dots = islands.flatMap((island, order) => islandDots(island, index * 0.37 + order * 0.29))
  return { ...region, label: label && { ...label, y: label.y + yOffset }, islands, dots, edges: regionEdges(dots) }
})

const semiconductorDots = ATLAS_CLUSTERS[2].dots
export const ATLAS_TECH_PORTFOLIO = [
  { ticker: 'AAPL', point: semiconductorDots[2] },
  { ticker: 'MSFT', point: semiconductorDots[3] },
  { ticker: 'NVDA', point: semiconductorDots[16] },
  { ticker: 'GOOGL', point: semiconductorDots[14] },
  { ticker: 'META', point: semiconductorDots[19] },
]

const [industry, cloud, energy, renewables, consumer] = [1, 3, 4, 5, 7].map((index) => ATLAS_CLUSTERS[index].dots)
export const ATLAS_PORTFOLIOS = {
  tech: ATLAS_TECH_PORTFOLIO.map(({ point }) => point),
  spread: [industry[1], cloud[3], energy[5], renewables[9], consumer[2]],
}

// A few connections hint at how the market regions relate as the dots settle.
const ROUTES = [[0, 1], [1, 2], [1, 7], [2, 3], [2, 6], [3, 4], [4, 5], [5, 9], [7, 8]]
export const ATLAS_ROUTES = ROUTES.map(([start, end], index) => {
  const pairs = ATLAS_CLUSTERS[start].dots.flatMap((from) => ATLAS_CLUSTERS[end].dots.map((to) => ({ from, to })))
  pairs.sort((a, b) => distance(a.from, a.to) - distance(b.from, b.to))
  return { ...pairs[0], id: `${start}-${end}`, bend: index % 2 === 0 ? 0.18 : -0.15 }
})

export function atlasRouteControl(from: Point, to: Point, bend: number): Point {
  return { x: (from.x + to.x) / 2 - (to.y - from.y) * bend, y: (from.y + to.y) / 2 + (to.x - from.x) * bend }
}
