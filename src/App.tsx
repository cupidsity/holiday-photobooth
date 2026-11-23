import { useEffect, useState } from 'react'
import { Booth } from './pages/Booth'
import { Invite } from './pages/Invite'

function currentRoute(): string {
  const path = window.location.pathname.replace(/\/+$/, '')
  if (path === '/invite' || window.location.hash === '#invite') return 'invite'
  return 'booth'
}

export function App() {
  const [route, setRoute] = useState(currentRoute)

  useEffect(() => {
    const sync = () => setRoute(currentRoute())
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])

  return route === 'invite' ? <Invite /> : <Booth />
}
