import { LoaderCircle } from 'lucide-react'

export function Card({ children, className = '' }) {
  return <section className={`card ${className}`}>{children}</section>
}

export function PageHeader({ eyebrow, title, description, children }) {
  return <div className="page-header">
    <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {children && <div className="page-actions">{children}</div>}
  </div>
}

export function Empty({ children = 'Nothing here yet.' }) {
  return <div className="empty">{children}</div>
}

export function Loading() {
  return <div className="loading"><LoaderCircle size={22} className="spin" /> Loading…</div>
}

export function ErrorNotice({ error, onClose }) {
  if (!error) return null
  return <div className="error-notice"><span>{error}</span>{onClose && <button onClick={onClose}>×</button>}</div>
}

export function Pill({ children, tone = '' }) {
  return <span className={`pill ${tone}`}>{children}</span>
}

