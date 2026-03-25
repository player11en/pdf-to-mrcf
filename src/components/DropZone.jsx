import { useCallback, useRef, useState } from 'react'

/**
 * Drag-and-drop / click-to-upload zone for a PDF file.
 *
 * Props:
 *  onFile(file: File) — called when a valid PDF is selected
 *  disabled: boolean
 */
export default function DropZone({ onFile, disabled }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleFile = useCallback(
    (file) => {
      if (!file) return
      if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
        alert('Please select a PDF file.')
        return
      }
      onFile(file)
    },
    [onFile],
  )

  const onDragOver = (e) => {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }
  const onDragLeave = () => setDragging(false)
  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    handleFile(file)
  }
  const onClick = () => {
    if (!disabled) inputRef.current?.click()
  }
  const onInputChange = (e) => {
    handleFile(e.target.files?.[0])
    // reset so same file can be re-selected
    e.target.value = ''
  }

  return (
    <div
      className={`dropzone ${dragging ? 'dropzone--drag' : ''} ${disabled ? 'dropzone--disabled' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label="Upload PDF"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={onInputChange}
        style={{ display: 'none' }}
      />
      <div className="dropzone__icon">📄</div>
      <p className="dropzone__primary">Drop your PDF here</p>
      <p className="dropzone__secondary">or click to browse</p>
    </div>
  )
}
