import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

export const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation()
  const navType = useNavigationType()

  useEffect(() => {
    // Only reset scroll to (0, 0) on new page transitions (PUSH).
    // When the user presses Back or Forward (POP), preserve the exact previous scroll position!
    if (navType !== 'POP') {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant' as ScrollBehavior
      })
    }
  }, [pathname, navType])

  return null
}
