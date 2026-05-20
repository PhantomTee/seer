'use client'

import type React from 'react'

/**
 * 3-D CSS dice that animates as if thrown, tumbles rapidly,
 * then lands on face 6, pauses, and repeats.
 *
 * Standard die: opposite faces sum to 7
 *   Front=1  Back=6   Right=3  Left=4   Top=5  Bottom=2
 */

// Dot layouts encoded as grid-area strings (row/col) in a 3×3 grid
const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [1, 3], [3, 1], [3, 3]],
  5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
  6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]],
}

function Face({ n, transform }: { n: number; transform: string }) {
  const dots = DOT_POSITIONS[n] ?? []
  return (
    <div
      className="dice-face"
      style={{ transform, gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(3,1fr)' }}
    >
      {dots.map(([r, c], i) => (
        <span
          key={i}
          className="dice-dot"
          style={{ gridRow: r, gridColumn: c }}
        />
      ))}
    </div>
  )
}

export function AnimatedDice({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  const half = 26 // half of 52px face size

  return (
    <div
      className={className}
      style={{ width: 52, height: 52, perspective: 220 }}
    >
      <div
        className="animate-dice-throw"
        style={{ width: 52, height: 52, position: 'relative', transformStyle: 'preserve-3d', ...style }}
      >
        {/* Front  — 1 */}
        <Face n={1} transform={`translateZ(${half}px)`} />
        {/* Back   — 6 */}
        <Face n={6} transform={`rotateY(180deg) translateZ(${half}px)`} />
        {/* Right  — 3 */}
        <Face n={3} transform={`rotateY(90deg) translateZ(${half}px)`} />
        {/* Left   — 4 */}
        <Face n={4} transform={`rotateY(-90deg) translateZ(${half}px)`} />
        {/* Top    — 5 */}
        <Face n={5} transform={`rotateX(90deg) translateZ(${half}px)`} />
        {/* Bottom — 2 */}
        <Face n={2} transform={`rotateX(-90deg) translateZ(${half}px)`} />
      </div>
    </div>
  )
}
