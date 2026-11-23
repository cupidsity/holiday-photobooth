import { useState } from 'react'
import { Booth } from './pages/Booth'
import { Invite } from './pages/Invite'

// one screen, two parts: the tree is the way in, and the booth fades up
// underneath it as the characters come apart. nothing navigates, so there is no
// reload between them
export function App() {
  const [opening, setOpening] = useState(false)
  const [settled, setSettled] = useState(false)

  function openBooth() {
    // the finished strip holds for a beat, then the booth comes up over it
    window.setTimeout(() => setOpening(true), 260)
    window.setTimeout(() => setSettled(true), 980)
  }

  return (
    <>
      {!settled && (
        <div className="layer tree-layer" aria-hidden={opening}>
          <Invite onEnter={openBooth} />
        </div>
      )}
      {opening && (
        <div className={`layer booth-layer${settled ? ' settled' : ''}`}>
          <Booth />
        </div>
      )}
    </>
  )
}
