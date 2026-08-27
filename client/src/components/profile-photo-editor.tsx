"use client"

import * as React from "react"
import { Camera, Loader2, Trash2, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  type ProfilePhotoCrop,
  loadProfilePhoto,
  renderProfilePhoto,
  validateProfilePhoto,
} from "@/lib/profile-photo"

export type ProfilePhotoEditorProps = {
  currentUrl?: string | null
  displayName: string
  /** Controlled by the parent while it is storing the exported image. */
  saving?: boolean
  /** Optional parent-reported upload completion percentage (0–100). */
  uploadProgress?: number
  onUpload: (photo: Blob) => void | Promise<void>
  onRemove: () => void | Promise<void>
  onCancel?: () => void
  className?: string
}

const ACCEPTED_IMAGES = "image/jpeg,image/png,image/webp,image/heic,image/heif"

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?"
}

export function ProfilePhotoEditor({
  currentUrl,
  displayName,
  saving = false,
  uploadProgress,
  onUpload,
  onRemove,
  onCancel,
  className,
}: ProfilePhotoEditorProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const cropAreaRef = React.useRef<HTMLDivElement>(null)
  const dragRef = React.useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const [source, setSource] = React.useState<Awaited<ReturnType<typeof loadProfilePhoto>> | null>(null)
  const [cropSize, setCropSize] = React.useState(280)
  const [scale, setScale] = React.useState(1)
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const [error, setError] = React.useState<string | null>(null)
  const [preparing, setPreparing] = React.useState(false)

  const minimumScale = React.useMemo(
    () => source ? cropSize / Math.min(source.width, source.height) : 1,
    [cropSize, source],
  )
  const maximumScale = minimumScale * 3

  const clampOffset = React.useCallback((next: { x: number; y: number }, nextScale = scale) => {
    if (!source) return { x: 0, y: 0 }
    const xLimit = Math.max(0, (source.width * nextScale - cropSize) / 2)
    const yLimit = Math.max(0, (source.height * nextScale - cropSize) / 2)
    return {
      x: Math.min(xLimit, Math.max(-xLimit, next.x)),
      y: Math.min(yLimit, Math.max(-yLimit, next.y)),
    }
  }, [cropSize, scale, source])

  React.useEffect(() => {
    const element = cropAreaRef.current
    if (!element) return
    const updateSize = () => setCropSize(Math.round(element.getBoundingClientRect().width))
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [source])

  React.useEffect(() => {
    if (source) {
      setScale(minimumScale)
      setOffset({ x: 0, y: 0 })
    }
  }, [source, minimumScale])

  React.useEffect(() => {
    if (scale < minimumScale) setScale(minimumScale)
    setOffset((value) => clampOffset(value, Math.max(scale, minimumScale)))
  }, [clampOffset, minimumScale, scale])

  const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    const validation = validateProfilePhoto(file)
    if (validation) {
      setError(validation)
      return
    }
    setPreparing(true)
    setError(null)
    try {
      setSource(await loadProfilePhoto(file))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This image could not be read.")
    } finally {
      setPreparing(false)
    }
  }

  const updateScale = (value: number) => {
    const nextScale = Number(value)
    setScale(nextScale)
    setOffset((previous) => clampOffset(previous, nextScale))
  }

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!source || saving) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
  }
  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = dragRef.current
    if (!start || start.pointerId !== event.pointerId) return
    const change = { x: event.clientX - start.x, y: event.clientY - start.y }
    setOffset((previous) => clampOffset({ x: previous.x + change.x, y: previous.y + change.y }))
    dragRef.current = { ...start, x: event.clientX, y: event.clientY }
  }
  const stopDrag = () => { dragRef.current = null }

  const cancel = () => {
    setSource(null)
    setError(null)
    onCancel?.()
  }
  const saveCrop = async () => {
    if (!source) return
    setPreparing(true)
    setError(null)
    try {
      const crop: ProfilePhotoCrop = { scale, x: offset.x, y: offset.y, cropSize }
      await onUpload(await renderProfilePhoto(source.image, crop))
      setSource(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to prepare this photo.")
    } finally {
      setPreparing(false)
    }
  }

  const busy = saving || preparing
  const shownUrl = source ? undefined : currentUrl
  return (
    <section className={className} aria-label="Profile photo editor">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
          {shownUrl ? <img src={shownUrl} alt={`${displayName}'s profile photo`} className="h-full w-full object-cover" /> :
            <span className="flex h-full w-full items-center justify-center text-xl font-medium text-muted-foreground">{initials(displayName)}</span>}
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">JPEG, PNG, WebP, or supported HEIC. Maximum 10 MB.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
              <Camera className="mr-2 h-4 w-4" />{currentUrl ? "Replace photo" : "Choose photo"}
            </Button>
            {currentUrl && !source && <Button type="button" variant="ghost" onClick={onRemove} disabled={busy}>
              <Trash2 className="mr-2 h-4 w-4" />Remove
            </Button>}
          </div>
        </div>
      </div>
      <input ref={inputRef} type="file" accept={ACCEPTED_IMAGES} className="sr-only" onChange={chooseFile} aria-label="Choose a profile photo" />

      {source && <div className="mt-5 space-y-4">
        <div ref={cropAreaRef} className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-lg bg-black touch-none select-none"
          onPointerDown={startDrag} onPointerMove={drag} onPointerUp={stopDrag} onPointerCancel={stopDrag} aria-label="Photo crop area. Drag the image to position it.">
          <img src={source.image.src} alt="" draggable={false} className="pointer-events-none absolute max-w-none"
            style={{ width: source.width * scale, height: source.height * scale, left: `calc(50% + ${offset.x}px)`, top: `calc(50% + ${offset.y}px)`, transform: "translate(-50%, -50%)" }} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
        <label className="block text-sm font-medium" htmlFor="profile-photo-zoom">Zoom
          <input id="profile-photo-zoom" type="range" className="mt-2 w-full" min={minimumScale} max={maximumScale} step={Math.max(minimumScale / 100, 0.001)}
            value={scale} onChange={(event) => updateScale(Number(event.target.value))} disabled={busy} aria-valuetext={`${Math.round((scale / minimumScale) * 100)} percent`} />
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={cancel} disabled={busy}><X className="mr-2 h-4 w-4" />Cancel</Button>
          <Button type="button" onClick={saveCrop} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {saving ? "Uploading…" : preparing ? "Preparing…" : "Save photo"}
          </Button>
        </div>
      </div>}
      {(saving && typeof uploadProgress === "number") && <div className="mt-3" role="status" aria-live="polite">
        <div className="mb-1 text-sm text-muted-foreground">Uploading {Math.round(uploadProgress)}%</div>
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, uploadProgress))}%` }} /></div>
      </div>}
      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
    </section>
  )
}