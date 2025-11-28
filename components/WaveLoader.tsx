type WaveLoaderProps = {
  className?: string
  barCount?: number
}

function WaveLoader({ className, barCount = 5 }: WaveLoaderProps) {
  const bars = Array.from({ length: barCount })
  const classes = ['wave-loader', className].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      {bars.map((_, index) => (
        <span key={index} className="wave-loader__bar" style={{ animationDelay: `${index * 0.12}s` }} />
      ))}
    </div>
  )
}

export default WaveLoader
