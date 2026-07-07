import { useMemo, useState } from 'react'
import './App.css'

const POLYGONS = [4, 5, 6, 7]
const MAX_POLYGON_SIDES = Math.max(...POLYGONS)
const POLYGON_NAMES = {
  4: '사각형',
  5: '오각형',
  6: '육각형',
  7: '칠각형',
}
const SVG_CENTER = 150
const NEW_VERTEX_OUTSET = 32
const NEW_VERTEX_OUTSET_STEPS = [32, 42, 54, 66]
const MIN_VERTEX_DISTANCE = 24
const MIN_CORNER_HEIGHT = 18
const SVG_SAFE_PADDING = 22

function getVertices(sides) {
  const radius = 130
  const startAngle = -Math.PI / 2

  return Array.from({ length: sides }, (_, index) => {
    const angle = startAngle + (index * 2 * Math.PI) / sides
    return {
      id: index,
      x: SVG_CENTER + radius * Math.cos(angle),
      y: SVG_CENTER + radius * Math.sin(angle),
    }
  })
}

function getPolygonCenter(vertices) {
  const total = vertices.reduce(
    (sum, vertex) => ({
      x: sum.x + vertex.x,
      y: sum.y + vertex.y,
    }),
    { x: 0, y: 0 },
  )

  return {
    x: total.x / vertices.length,
    y: total.y / vertices.length,
  }
}

function getDistance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function getCornerHeight(left, middle, right) {
  const baseLength = getDistance(left, right) || 1
  const cross =
    (middle.x - left.x) * (right.y - left.y) - (middle.y - left.y) * (right.x - left.x)

  return Math.abs(cross) / baseLength
}

function getOutwardUnitVector(midpoint, center, edgeStart, edgeEnd) {
  const outwardVector = {
    x: midpoint.x - center.x,
    y: midpoint.y - center.y,
  }
  const vectorLength = Math.hypot(outwardVector.x, outwardVector.y)

  if (vectorLength > 0.001) {
    return {
      x: outwardVector.x / vectorLength,
      y: outwardVector.y / vectorLength,
    }
  }

  const edgeVector = {
    x: edgeEnd.x - edgeStart.x,
    y: edgeEnd.y - edgeStart.y,
  }
  const normal = {
    x: -edgeVector.y,
    y: edgeVector.x,
  }
  const normalLength = Math.hypot(normal.x, normal.y) || 1

  return {
    x: normal.x / normalLength,
    y: normal.y / normalLength,
  }
}

function getDistanceToSafeEdge(midpoint, unitVector) {
  return Math.min(
    unitVector.x > 0 ? (300 - SVG_SAFE_PADDING - midpoint.x) / unitVector.x : Infinity,
    unitVector.x < 0 ? (SVG_SAFE_PADDING - midpoint.x) / unitVector.x : Infinity,
    unitVector.y > 0 ? (300 - SVG_SAFE_PADDING - midpoint.y) / unitVector.y : Infinity,
    unitVector.y < 0 ? (SVG_SAFE_PADDING - midpoint.y) / unitVector.y : Infinity,
  )
}

function isSafeNewVertex(candidate, vertices, edgeStart, edgeEnd) {
  const hasEnoughDistance = vertices.every((vertex) => getDistance(candidate, vertex) >= MIN_VERTEX_DISTANCE)
  const hasCornerShape = getCornerHeight(edgeStart, candidate, edgeEnd) >= MIN_CORNER_HEIGHT

  return hasEnoughDistance && hasCornerShape
}

function getCandidateVertex(edgeStart, edgeEnd, center, nextId, requestedOutset) {
  const midpoint = {
    x: (edgeStart.x + edgeEnd.x) / 2,
    y: (edgeStart.y + edgeEnd.y) / 2,
  }
  const unitVector = getOutwardUnitVector(midpoint, center, edgeStart, edgeEnd)
  const distanceToSafeEdge = getDistanceToSafeEdge(midpoint, unitVector)
  const outset = Math.max(0, Math.min(requestedOutset, distanceToSafeEdge))

  return {
    id: nextId,
    x: midpoint.x + unitVector.x * outset,
    y: midpoint.y + unitVector.y * outset,
  }
}

function addVertexOnLongestEdge(vertices) {
  const center = getPolygonCenter(vertices)
  const nextId = Math.max(...vertices.map((vertex) => vertex.id)) + 1
  const rankedEdges = vertices
    .map((vertex, index) => {
      const nextIndex = (index + 1) % vertices.length
      const nextVertex = vertices[nextIndex]

      return {
        startIndex: index,
        endIndex: nextIndex,
        start: vertex,
        end: nextVertex,
        length: getDistance(vertex, nextVertex),
      }
    })
    .sort((first, second) => second.length - first.length)

  for (const edge of rankedEdges) {
    for (const outset of NEW_VERTEX_OUTSET_STEPS) {
      const candidate = getCandidateVertex(edge.start, edge.end, center, nextId, outset)

      if (isSafeNewVertex(candidate, vertices, edge.start, edge.end)) {
        return [
          ...vertices.slice(0, edge.startIndex + 1),
          candidate,
          ...vertices.slice(edge.startIndex + 1),
        ]
      }
    }
  }

  const fallbackEdge = rankedEdges[0]
  const fallback = getCandidateVertex(fallbackEdge.start, fallbackEdge.end, center, nextId, NEW_VERTEX_OUTSET)

  return [
    ...vertices.slice(0, fallbackEdge.startIndex + 1),
    fallback,
    ...vertices.slice(fallbackEdge.startIndex + 1),
  ]
}

function getLineKey(a, b) {
  return [a, b].sort((left, right) => left - right).join('-')
}

function isSide(a, b, vertices) {
  const firstIndex = vertices.findIndex((vertex) => vertex.id === a)
  const secondIndex = vertices.findIndex((vertex) => vertex.id === b)

  if (firstIndex === -1 || secondIndex === -1) {
    return false
  }

  const distance = Math.abs(firstIndex - secondIndex)
  return distance === 1 || distance === vertices.length - 1
}

function diagonalCount(vertexCount) {
  return (vertexCount * (vertexCount - 3)) / 2
}

function App() {
  const [selectedSides, setSelectedSides] = useState(4)
  const [polygonVertices, setPolygonVertices] = useState({})
  const [selectedVertex, setSelectedVertex] = useState(null)
  const [drawnDiagonals, setDrawnDiagonals] = useState({})
  const [newDiagonalKeys, setNewDiagonalKeys] = useState({})
  const [completedCounts, setCompletedCounts] = useState({})
  const [feedback, setFeedback] = useState('꼭짓점 두 개를 차례로 선택해 보세요.')
  const [showHint, setShowHint] = useState(false)
  const [note, setNote] = useState('')

  const vertices = useMemo(
    () => polygonVertices[selectedSides] ?? getVertices(selectedSides),
    [polygonVertices, selectedSides],
  )
  const polygonPoints = vertices.map((point) => `${point.x},${point.y}`).join(' ')
  const vertexById = useMemo(() => new Map(vertices.map((vertex) => [vertex.id, vertex])), [vertices])
  const currentKeys = drawnDiagonals[selectedSides] ?? []
  const currentNewKeys = newDiagonalKeys[selectedSides] ?? []
  const currentCount = currentKeys.length
  const totalCount = diagonalCount(vertices.length)
  const currentPolygonName = POLYGON_NAMES[vertices.length] ?? `${vertices.length}각형`
  const canAddVertex = currentCount === totalCount && totalCount > 0 && vertices.length < MAX_POLYGON_SIDES

  function changePolygon(sides) {
    setSelectedSides(sides)
    setSelectedVertex(null)
    setFeedback('꼭짓점 두 개를 차례로 선택해 보세요.')
  }

  function resetCurrentPolygon() {
    setDrawnDiagonals((previous) => ({
      ...previous,
      [selectedSides]: [],
    }))
    setNewDiagonalKeys((previous) => ({
      ...previous,
      [selectedSides]: [],
    }))
    setCompletedCounts((previous) => {
      const next = { ...previous }
      delete next[vertices.length]
      return next
    })
    setSelectedVertex(null)
    setFeedback('초기화했어요. 다시 대각선을 찾아보세요.')
  }

  function addOneVertex() {
    if (!canAddVertex) {
      return
    }

    const nextVertices = addVertexOnLongestEdge(vertices)
    const nextSides = nextVertices.length

    setPolygonVertices((previous) => ({
      ...previous,
      [nextSides]: nextVertices,
    }))
    setDrawnDiagonals((previous) => ({
      ...previous,
      [nextSides]: currentKeys,
    }))
    setNewDiagonalKeys((previous) => ({
      ...previous,
      [nextSides]: [],
    }))
    setSelectedSides(nextSides)
    setSelectedVertex(null)
    setFeedback('새 꼭짓점이 추가되었습니다. 새롭게 필요한 대각선을 이어서 그려 보세요.')
  }

  function handleVertexClick(vertexId) {
    if (selectedVertex === null) {
      setSelectedVertex(vertexId)
      setFeedback(`${vertexId + 1}번 꼭짓점을 선택했어요. 다른 꼭짓점을 선택해 보세요.`)
      return
    }

    if (selectedVertex === vertexId) {
      setSelectedVertex(null)
      setFeedback('같은 꼭짓점을 다시 선택했어요. 두 꼭짓점을 차례로 골라주세요.')
      return
    }

    if (isSide(selectedVertex, vertexId, vertices)) {
      setSelectedVertex(null)
      setFeedback('이 선분은 변이에요. 대각선이 아니에요.')
      return
    }

    const nextKey = getLineKey(selectedVertex, vertexId)
    if (currentKeys.includes(nextKey)) {
      setSelectedVertex(null)
      setFeedback('이미 그은 대각선이에요.')
      return
    }

    const nextKeys = [...currentKeys, nextKey]
    setDrawnDiagonals((previous) => ({
      ...previous,
      [selectedSides]: nextKeys,
    }))
    setNewDiagonalKeys((previous) => ({
      ...previous,
      [selectedSides]: [...(previous[selectedSides] ?? []), nextKey],
    }))

    if (nextKeys.length === totalCount) {
      setCompletedCounts((previous) => ({
        ...previous,
        [vertices.length]: totalCount,
      }))
      setFeedback(`${currentPolygonName}의 대각선은 모두 ${totalCount}개입니다.`)
    } else {
      setFeedback('대각선을 추가했어요. 빠뜨린 대각선이 더 있는지 살펴보세요.')
    }

    setSelectedVertex(null)
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>다각형의 대각선 개수는 어떻게 구할까?</h1>
      </header>

      <section className="dashboard-grid" aria-label="다각형의 대각선 탐구 화면">
        <section className="panel workspace-panel" aria-labelledby="workspace-title">
          <div className="panel-heading">
            <div>
              <h2 id="workspace-title">대각선 그리기</h2>
              <p>모든 대각선을 빠짐없이 찾아 그려 봅시다.</p>
            </div>
            <div className="panel-actions">
              <button type="button" className="ghost-button" onClick={resetCurrentPolygon}>
                초기화
              </button>
              <button
                type="button"
                className="ghost-button add-vertex-button"
                onClick={addOneVertex}
                disabled={!canAddVertex}
              >
                꼭짓점 한 개 추가
              </button>
            </div>
          </div>

          <div className="polygon-controls" aria-label="다각형 선택">
            {POLYGONS.map((sides) => (
              <button
                type="button"
                key={sides}
                className={selectedSides === sides ? 'active' : ''}
                onClick={() => changePolygon(sides)}
              >
                {POLYGON_NAMES[sides]}
              </button>
            ))}
          </div>

          <div className="svg-frame">
            <svg
              viewBox="0 0 300 300"
              role="img"
              aria-label={`${POLYGON_NAMES[selectedSides]} 탐구 그림`}
            >
              <polygon points={polygonPoints} className="polygon-shape" />
              {currentKeys.map((key) => {
                const [start, end] = key.split('-').map(Number)
                const startVertex = vertexById.get(start)
                const endVertex = vertexById.get(end)

                if (!startVertex || !endVertex) {
                  return null
                }

                return (
                  <line
                    key={key}
                    className={
                      currentNewKeys.includes(key)
                        ? 'diagonal-line new-diagonal-line'
                        : 'diagonal-line existing-diagonal-line'
                    }
                    x1={startVertex.x}
                    y1={startVertex.y}
                    x2={endVertex.x}
                    y2={endVertex.y}
                  />
                )
              })}
              {vertices.map((vertex) => (
                <g key={vertex.id}>
                  <circle
                    className={selectedVertex === vertex.id ? 'vertex selected' : 'vertex'}
                    cx={vertex.x}
                    cy={vertex.y}
                    r="15"
                    onClick={() => handleVertexClick(vertex.id)}
                  />
                  <text className="vertex-label" x={vertex.x} y={vertex.y + 5}>
                    {vertex.id + 1}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="status-row">
            <div className="count-card">
              <span className="metric-label">현재 그린 대각선</span>
              <strong>{currentCount}개</strong>
            </div>
            <div className="message-card">
              <span className="metric-label">안내 메시지</span>
              <p aria-live="polite">{feedback}</p>
            </div>
          </div>
        </section>

        <section className="panel data-panel" aria-labelledby="data-title">
          <div className="panel-heading compact">
            <div>
              <h2 id="data-title">대각선 개수</h2>
              <p>탐구한 결과를 표에 정리해 봅시다.</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>다각형</th>
                <th>대각선 개수</th>
              </tr>
            </thead>
            <tbody>
              {POLYGONS.map((sides) => (
                <tr key={sides} className={vertices.length === sides ? 'selected-row' : ''}>
                  <td>{POLYGON_NAMES[sides]}</td>
                  <td>{completedCounts[sides] ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <aside className="panel inquiry-panel" aria-labelledby="inquiry-title">
          <div className="question-card">
            <h2 id="inquiry-title">탐구 질문</h2>
            <label htmlFor="student-note">
              표를 보고 발견한 점이나 궁금한 점을 자유롭게 적어 봅시다.
            </label>
            <textarea
              id="student-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="예: 꼭짓점이 늘어날수록 대각선도 더 빨리 늘어나는 것 같아요."
            />
            <button type="button" className="primary-button" onClick={() => setShowHint(true)}>
              다음 질문
            </button>
            {showHint && (
              <p className="hint" aria-live="polite">
                한 꼭짓점에만 집중해 보면 어떤 규칙이 보일까요?
              </p>
            )}
          </div>
        </aside>
      </section>
    </main>
  )
}

export default App
