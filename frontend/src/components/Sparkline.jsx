export default function Sparkline({ values = [], label = '趋势' }) {
  const numeric = values.map(Number).filter(Number.isFinite)
  if (numeric.length < 2) return <div className="sparkline-empty">运行两次后显示趋势</div>

  const width = 280
  const height = 84
  const min = Math.min(...numeric)
  const max = Math.max(...numeric)
  const range = max - min || 1
  const points = numeric.map((value, index) => {
    const x = 8 + (index / (numeric.length - 1)) * (width - 16)
    const y = height - 8 - ((value - min) / range) * (height - 16)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const [lastX, lastY] = points.split(' ').at(-1).split(',')

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <line x1="8" y1={height - 8} x2={width - 8} y2={height - 8} />
      <polyline points={points} />
      <circle cx={lastX} cy={lastY} r="4" />
    </svg>
  )
}
