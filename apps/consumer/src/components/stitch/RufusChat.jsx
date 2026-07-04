import React, { useState, useRef, useEffect } from 'react'
import { askRufus } from '@amazon-hackon/shared'

// "Ask Rufus" — the product-page conversational shopping assistant.
//
// UI ported from the Claude Design "Amazon website pages replication" project
// (the Kai assistant panel), rebranded to Rufus / "Amazon shopping assistant" and
// wired to the REAL backend: POST /api/rufus/ attaches the full product context by
// listing_id and returns a grounded answer. A left side-panel opens from a teal
// pill trigger; suggestion + follow-up chips, typing dots and a product-context
// chip all match the imported design.

// Suggested opening questions (design "Try asking" chips, tuned for a second-life
// marketplace where condition & value are what shoppers actually ask about).
const SUGGESTED = [
  'What condition is this in?',
  'Why is it cheaper than new?',
  'What do buyers say about it?',
  'How is the sizing — true to fit?',
  'Is this a good deal?',
]

// Follow-up chip pool — shown under the latest answer (backend returns plain text,
// so we surface fresh suggestions the shopper hasn't asked yet).
const FOLLOWUPS = [
  'Is it worth the price?',
  'What comes in the box?',
  'How do returns work here?',
  'Are there any defects?',
  'How does the grade affect it?',
  'Is it covered by a warranty?',
]

// Render lightweight **bold** markdown the model sometimes emits.
const renderRich = (text = '') =>
  text.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
    seg.startsWith('**') && seg.endsWith('**')
      ? <strong key={i}>{seg.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{seg}</React.Fragment>
  )

// Teal sparkle avatar (design's Kai mark).
const RufusMark = ({ size = 34, icon = 19 }) => (
  <span
    style={{ width: size, height: size }}
    className="rounded-full inline-flex items-center justify-center flex-shrink-0
      bg-gradient-to-br from-[#19c39c] to-[#12a17f]"
  >
    <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
      <path d="M12 2l2.2 5.5L20 9l-4.5 3.8L17 19l-5-3-5 3 1.5-6.2L4 9l5.8-1.5z" />
    </svg>
  </span>
)

const RufusChat = ({ listing }) => {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([]) // { role:'user'|'assistant', content, grounded? }
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const product = listing?.product || {}
  const productTitle = product.title || 'this product'
  const thumb = listing?.image || product.reference_image_url

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120)
  }, [open])

  const asked = messages.filter((m) => m.role === 'user').map((m) => m.content.toLowerCase())
  const followUps = FOLLOWUPS.filter((q) => !asked.includes(q.toLowerCase())).slice(0, 2)

  const send = async (text) => {
    const question = (text ?? input).trim()
    if (!question || loading) return

    const history = messages.map(({ role, content }) => ({ role, content }))
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setInput('')
    setLoading(true)

    try {
      const { data } = await askRufus({ question, listing_id: listing?.id, history })
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer, grounded: data.grounded }])
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: "Sorry — I couldn't reach the assistant just now. Please try again.",
        grounded: false,
      }])
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const hasMsgs = messages.length > 0

  return (
    <>
      {/* dot-blink keyframes (design's kaiblink) */}
      <style>{`@keyframes rufusblink{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}`}</style>

      {/* ── Floating pill trigger (design's "Ask Kai about this product") ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[80] inline-flex items-center gap-2 bg-white rounded-full
            pl-2.5 pr-5 py-2.5 text-[14px] font-bold text-[#0f5c47] cursor-pointer
            border border-[#19c39c] shadow-[0_6px_20px_rgba(18,161,127,0.35)]
            transition-all hover:shadow-[0_8px_26px_rgba(18,161,127,0.5)] hover:-translate-y-0.5"
          aria-label="Ask Sage about this product"
        >
          <RufusMark size={30} icon={16} />
          Ask Sage about this product
        </button>
      )}

      {/* ── Backdrop ── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[60] bg-black/30"
          aria-hidden="true"
        />
      )}

      {/* ── Left side panel ── */}
      {open && (
        <div
          className="fixed top-0 left-0 bottom-0 z-[70] w-[400px] max-w-[92vw] bg-[#fbfcfd]
            border-r border-[#e3e7eb] shadow-[6px_0_24px_rgba(15,34,51,.12)] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[#eef1f4] bg-white flex-shrink-0">
            <RufusMark />
            <div className="leading-tight">
              <div className="text-[17px] font-extrabold tracking-tight text-[#16181d]">
                Sage <span className="text-[10px] font-semibold text-[#9aa6b2] tracking-wide">AI · beta</span>
              </div>
              <div className="text-[11px] text-[#9aa6b2]">Revive shopping assistant</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#f0f2f4] transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#565f6b" strokeWidth="2">
                <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            </button>
          </div>

          {/* Scroll body */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-[18px]">
            {/* Product context chip */}
            <div className="flex items-center gap-2.5 bg-white border border-[#eef1f4] rounded-[10px] px-2.5 py-2 mb-4">
              <div className="w-10 h-10 flex-shrink-0 rounded-md bg-[#f2f4f6] flex items-center justify-center overflow-hidden">
                {thumb
                  ? <img src={thumb} alt="" className="max-w-full max-h-full object-contain mix-blend-multiply"
                      onError={(e) => { e.target.style.display = 'none' }} />
                  : <span className="text-[#9aa6b2] text-[8px] font-mono">IMG</span>}
              </div>
              <div className="text-[12px] text-[#2b3440] leading-snug line-clamp-2">{productTitle}</div>
            </div>

            {/* Empty state */}
            {!hasMsgs && (
              <>
                <div className="text-center pt-3.5 pb-1 px-1.5">
                  <div className="w-14 h-14 mx-auto mb-3.5 rounded-full flex items-center justify-center
                    bg-gradient-to-br from-[#e6f7f0] to-[#d9f2ff]">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#12a17f" strokeWidth="1.8">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div className="text-[19px] font-extrabold mb-1.5 text-[#16181d]">Have any questions about this product?</div>
                  <div className="text-[13px] text-[#565f6b] leading-relaxed max-w-[300px] mx-auto">
                    Hi, I'm Sage. Ask me anything about condition, sizing, value, or delivery.
                    Answers are AI-generated, so double-check the important bits.
                  </div>
                </div>
                <div className="text-[11px] font-bold text-[#9aa6b2] uppercase tracking-wide mt-5 mb-2.5">Try asking</div>
                <div className="flex flex-col gap-2.5">
                  {SUGGESTED.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="flex items-center justify-between gap-2 text-left bg-white border border-[#d5dbe1]
                        rounded-xl px-3.5 py-3 text-[13px] text-[#16181d] cursor-pointer transition-colors
                        hover:border-[#19c39c] hover:bg-[#f6fefb]"
                    >
                      <span>{q}</span>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#19c39c" strokeWidth="2.2" className="flex-shrink-0">
                        <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
                      </svg>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Conversation */}
            {hasMsgs && (
              <div className="flex flex-col gap-3.5">
                {messages.map((m, i) => {
                  const isLastBot = m.role === 'assistant' && i === messages.length - 1 && !loading
                  return m.role === 'user' ? (
                    <div key={i} className="self-end max-w-[85%] bg-[#152233] text-white rounded-[14px_14px_4px_14px]
                      px-3.5 py-2.5 text-[13px] leading-relaxed">
                      {m.content}
                    </div>
                  ) : (
                    <div key={i} className="self-start max-w-[92%]">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <RufusMark size={18} icon={10} />
                        <span className="text-[11px] font-bold text-[#12805f]">Sage</span>
                        {m.grounded === false && (
                          <span className="text-[10px] text-[#9aa6b2]">· offline</span>
                        )}
                      </div>
                      <div className="bg-white border border-[#eef1f4] rounded-[4px_14px_14px_14px] px-3.5 py-3
                        text-[13px] leading-relaxed text-[#2b3440] whitespace-pre-wrap">
                        {renderRich(m.content)}
                      </div>
                      {isLastBot && followUps.map((fc) => (
                        <button
                          key={fc}
                          onClick={() => send(fc)}
                          className="inline-flex items-center gap-1.5 mt-2 mr-2 bg-[#f2fbf8] border border-[#cdeee3]
                            rounded-full px-3 py-1.5 text-[12px] text-[#0f5c47] cursor-pointer transition-colors hover:bg-[#e2f5ee]"
                        >
                          {fc}
                        </button>
                      ))}
                    </div>
                  )
                })}

                {/* Typing dots */}
                {loading && (
                  <div className="self-start flex items-center gap-1.5 bg-white border border-[#eef1f4] rounded-[14px] px-4 py-3">
                    {['0s', '.2s', '.4s'].map((d) => (
                      <span key={d} className="w-[7px] h-[7px] rounded-full bg-[#19c39c]"
                        style={{ animation: `rufusblink 1s infinite ${d}` }} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send() }}
            className="border-t border-[#eef1f4] bg-white px-3.5 py-3 flex-shrink-0"
          >
            <div className="flex items-end gap-2 border border-[#d5dbe1] rounded-[22px] pl-4 pr-1.5 py-1.5 bg-white
              focus-within:border-[#19c39c] transition-colors">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask Sage about this product"
                className="flex-1 border-none outline-none text-[14px] py-1.5 bg-transparent min-w-0"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                aria-label="Send"
                className="w-9 h-9 flex-shrink-0 rounded-full bg-[#19c39c] hover:bg-[#12a17f] disabled:opacity-40
                  disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <div className="text-[10px] text-[#9aa6b2] text-center mt-1.5">Sage can make mistakes. Verify important details.</div>
          </form>
        </div>
      )}
    </>
  )
}

export default RufusChat
