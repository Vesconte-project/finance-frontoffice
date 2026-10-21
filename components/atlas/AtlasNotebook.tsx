'use client'

import { X } from 'lucide-react'
import { noteDetails, type NotebookEntry } from '@/lib/atlas-pro'
import base from './AtlasExplorer.module.css'
import styles from './AtlasPro.module.css'

/**
 * The notebook (pro-spec §7): views saved with the reader's own notes, kept in
 * this browser, that open again on the current week's data.
 */
export default function AtlasNotebook({ notes, stored, onSave, onOpen, onDelete, onNote, onClose }: {
  notes: NotebookEntry[]
  /** False when the browser refused to keep them: they last for this visit only. */
  stored: boolean
  onSave: () => void
  onOpen: (entry: NotebookEntry) => void
  onDelete: (entry: NotebookEntry) => void
  onNote: (entry: NotebookEntry, note: string) => void
  onClose: () => void
}) {
  return (
    <section id="atlas-notebook" className={base.sheet} aria-labelledby="atlas-notebook-title" data-lenis-prevent="">
      <div className={styles.dockHead}>
        <h2 id="atlas-notebook-title">Notebook</h2>
        <button type="button" className={styles.dockClose} onClick={onClose} aria-label="Close the notebook"><X size={15} aria-hidden="true" /></button>
      </div>
      <button type="button" className={styles.save} onClick={onSave}>Save this view</button>
      {stored ? null : <p className={styles.muted}>This browser is not keeping them: they last for this visit only.</p>}
      {notes.length ? (
        <ul className={styles.rows}>
          {notes.map((entry) => (
            <li key={entry.id} className={styles.row}>
              <b>{entry.title}</b>
              <span className={styles.rowActions}>
                <button type="button" onClick={() => onOpen(entry)} aria-label={`Open ${entry.title}`}>Open</button>
                <button type="button" onClick={() => onDelete(entry)} aria-label={`Delete ${entry.title}`}>Delete</button>
              </span>
              <small>{new Date(entry.savedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} · {noteDetails(entry.view)}</small>
              <textarea aria-label={`Note for ${entry.title}`} placeholder="Your note" defaultValue={entry.note} maxLength={4000} onChange={(event) => onNote(entry, event.target.value)} />
            </li>
          ))}
        </ul>
      ) : <p className={styles.empty}>Nothing saved yet.</p>}
    </section>
  )
}
