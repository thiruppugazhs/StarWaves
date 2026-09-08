import { useCallback } from 'react'
import { useMotionValue, useReducedMotion, useSpring } from 'framer-motion'

const PULL = 6
const STIFFNESS = 260
const DAMPING = 18

export function useMagnetic() {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: STIFFNESS, damping: DAMPING })
  const sy = useSpring(y, { stiffness: STIFFNESS, damping: DAMPING })

  const onMouseMove = useCallback(
    (event) => {
      if (reduce) return
      const rect = event.currentTarget.getBoundingClientRect()
      x.set(((event.clientX - rect.left) / rect.width - 0.5) * PULL * 2)
      y.set(((event.clientY - rect.top) / rect.height - 0.5) * PULL * 2)
    },
    [reduce, x, y],
  )

  const onMouseLeave = useCallback(() => {
    x.set(0)
    y.set(0)
  }, [x, y])

  if (reduce) return {}
  return { style: { x: sx, y: sy }, onMouseMove, onMouseLeave }
}
