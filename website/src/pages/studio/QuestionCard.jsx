import { useState } from 'react'
import { ArrowRight, Check, HelpCircle, Send, Sparkles } from 'lucide-react'

export function QuestionCard({ questions = [], onAnswerAll, onAnswerSingle }) {
  const [answers, setAnswers] = useState({})
  const [customInputs, setCustomInputs] = useState({})

  if (!questions || questions.length === 0) return null

  const handleSelectOption = (question, answerText) => {
    const nextAnswers = { ...answers, [question.id]: answerText }
    setAnswers(nextAnswers)

    // If single question, submit immediately
    if (questions.length === 1) {
      onAnswerSingle?.(answerText)
      return
    }

    // If all answered, trigger submit
    if (Object.keys(nextAnswers).length === questions.length) {
      submitAll(nextAnswers)
    }
  }

  const handleCustomSubmit = (question) => {
    const val = (customInputs[question.id] || '').trim()
    if (!val) return
    handleSelectOption(question, val)
  }

  const submitAll = (currentAnswers = answers) => {
    const formatted = questions
      .map((q) => {
        const ans = currentAnswers[q.id] || q.recommended
        return `${q.num}. ${ans}`
      })
      .join('\n')
    onAnswerAll?.(formatted)
  }

  const answeredCount = Object.keys(answers).length

  return (
    <div className="studio-question-card" aria-label="Interactive planning questions">
      <div className="studio-question-header">
        <div className="studio-question-header-title">
          <HelpCircle size={14} className="studio-question-icon" aria-hidden="true" />
          <span>Interactive Plan Setup</span>
        </div>
        <span className="studio-question-counter">
          {answeredCount}/{questions.length} answered
        </span>
      </div>

      <div className="studio-question-list">
        {questions.map((q) => {
          const selectedAnswer = answers[q.id]
          const isAnswered = Boolean(selectedAnswer)

          return (
            <div key={q.id} className={`studio-question-item ${isAnswered ? 'answered' : ''}`}>
              <div className="studio-question-prompt">
                <span className="studio-question-num">{q.num}</span>
                <p className="studio-question-text">{q.text}</p>
              </div>

              <div className="studio-question-choices">
                {/* Recommended Option */}
                <button
                  type="button"
                  className={`studio-choice-btn recommended ${selectedAnswer === q.recommended ? 'selected' : ''}`}
                  onClick={() => handleSelectOption(q, q.recommended)}
                >
                  <span className="studio-choice-tag">
                    <Sparkles size={11} aria-hidden="true" />
                    Recommended
                  </span>
                  <span className="studio-choice-label">{q.recommended}</span>
                  {selectedAnswer === q.recommended && <Check size={14} className="studio-choice-check" />}
                </button>

                {/* Alternative Option */}
                {q.alternative && (
                  <button
                    type="button"
                    className={`studio-choice-btn ${selectedAnswer === q.alternative ? 'selected' : ''}`}
                    onClick={() => handleSelectOption(q, q.alternative)}
                  >
                    <span className="studio-choice-label">{q.alternative}</span>
                    {selectedAnswer === q.alternative && <Check size={14} className="studio-choice-check" />}
                  </button>
                )}

                {/* Type your own answer */}
                <div className="studio-custom-answer-row">
                  <input
                    type="text"
                    className="studio-custom-answer-input"
                    placeholder="Type your own answer…"
                    value={customInputs[q.id] || ''}
                    onChange={(e) =>
                      setCustomInputs((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCustomSubmit(q)
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="studio-custom-answer-btn"
                    onClick={() => handleCustomSubmit(q)}
                    disabled={!(customInputs[q.id] || '').trim()}
                    aria-label="Confirm custom answer"
                    title="Confirm answer"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {questions.length > 1 && (
        <div className="studio-question-footer">
          <button
            type="button"
            className="primary-button studio-question-submit-btn"
            onClick={() => submitAll()}
          >
            <span>Submit Answers</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
