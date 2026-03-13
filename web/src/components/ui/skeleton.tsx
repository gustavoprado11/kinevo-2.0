function Skeleton({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-black/5 dark:bg-white/5 ${className}`}
      {...props}
    />
  )
}

export { Skeleton }
