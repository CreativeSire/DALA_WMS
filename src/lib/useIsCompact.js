import { useEffect, useState } from 'react'

export function useIsCompact(breakpoint = 820) {
  const getValue = () => (typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false)
  const [isCompact, setIsCompact] = useState(getValue)

  useEffect(() => {
    function handleResize() {
      setIsCompact(getValue())
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoint])

  return isCompact
}
