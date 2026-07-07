import { useMemo, useState } from 'react'
import './App.css'

const POLYGONS = [4, 5, 6, 7]
const POLYGON_NAMES = {
  4: '사각형',
  5: '오각형',
  6: '육각형',
  7: '칠각형',
}

function getVertices(sides) {
  const center = 150
  const radius = 130
  const startAngle = -Math.PI / 2

  return Array.from({ length: sides }, (_, index) => {
    const angle = startAngle + (index * 2 * Math.PI) / sides
    return {
      id: index,
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    }
  })
}

function getLineKey(a, b) {
  return [a, b].sort((left, right) => left - right).join('-')
}

function isSide(a, b, sides) {
  const distance = Math.abs(a - b)
  return distance === 1 || distance === sides - 1
}

function diagonalCount(sides) {
  return (sides * (sides - 3)) / 2
}

function App() {
  const [selectedSides, setSelectedSides] = useState(4)
  const [selectedVertex, setSelectedVertex] = useState(null)
  const [drawnDiagonals, setDrawnDiagonals] = useState({})
  const [completedCounts, setCompletedCounts] = useState({})
  const [feedback, setFeedback] = useState('꼭짓점 두 개를 차례로 선택해 보세요.')
  const [showHint, setShowHint] = useState(false)
  const [note, setNote] = useState('')

  const vertices = useMemo(() => getVertices(selectedSides), [selectedSides])
  const polygonPoints = vertices.map((point) => `${point.x},${point.y}`).join(' ')
  const currentKeys = drawnDiagonals[selectedSides] ?? []
  const currentCount = currentKeys.length
  const totalCount = diagonalCount(selectedSides)

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
    setCompletedCounts((previous) => {
      const next = { ...previous }
      delete next[selectedSides]
      return next
    })
    setSelectedVertex(null)
    setFeedback('초기화했어요. 다시 대각선을 찾아보세요.')
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

    if (isSide(selectedVertex, vertexId, selectedSides)) {
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

    if (nextKeys.length === totalCount) {
      setCompletedCounts((previous) => ({
        ...previous,
        [selectedSides]: totalCount,
      }))
      setFeedback(`${POLYGON_NAMES[selectedSides]}의 대각선은 모두 ${totalCount}개입니다.`)
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
            <button type="button" className="ghost-button" onClick={resetCurrentPolygon}>
              초기화
            </button>
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
                return (
                  <line
                    key={key}
                    className="diagonal-line"
                    x1={vertices[start].x}
                    y1={vertices[start].y}
                    x2={vertices[end].x}
                    y2={vertices[end].y}
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
                <tr key={sides} className={selectedSides === sides ? 'selected-row' : ''}>
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
