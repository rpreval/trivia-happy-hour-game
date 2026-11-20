<button
                type="button"
                disabled={game?.status !== 'QUESTION_SET'}
                onClick={() => send({ type: 'NEXT_QUESTION' })}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-sm"
              >
                Next Question (Q{(game?.currentQuestionIndex ?? 0) + 1} of {questions.length || 3} →)
              </button>
