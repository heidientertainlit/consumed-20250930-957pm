export const MAX_PROFILE_PHOTO_BYTES = 10 * 1024 * 1024
export const PROFILE_PHOTO_SIZE = 512

const supportedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
])

export type ProfilePhotoSource = {
  image: HTMLImageElement
  width: number
  height: number
  objectUrl: string
}

export function validateProfilePhoto(file: File): string | null {
  const type = file.type.toLowerCase()
  const extension = file.name.split(".").pop()?.toLowerCase()
  const supportedExtension = ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(extension || "")
  if (!supportedTypes.has(type) && !supportedExtension) {
    return "Choose a JPEG, PNG, WebP, or HEIC photo."
  }

  if (file.size > MAX_PROFILE_PHOTO_BYTES) {
    return "That photo is larger than 10 MB. Please choose a smaller file."
  }

  return null
}

/**
 * Loads an image through the browser decoder. HEIC/HEIF files are accepted by
 * the picker, but this rejects them with a useful message on browsers that
 * cannot decode them.
 */
export function loadProfilePhoto(file: File): Promise<ProfilePhotoSource> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        URL.revokeObjectURL(url)
        reject(new Error("This image could not be read."))
        return
      }
      resolve({ image, width: image.naturalWidth, height: image.naturalHeight, objectUrl: url })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      const extension = file.name.split(".").pop()?.toLowerCase()
      const isHeic = file.type === "image/heic" || file.type === "image/heif"
        || extension === "heic" || extension === "heif"
      reject(new Error(isHeic
        ? "This browser cannot decode this HEIC photo. Please use JPEG, PNG, or WebP."
        : "This image could not be read."))
    }
    image.src = url
  })
}

export type ProfilePhotoCrop = {
  /** Rendered image scale in screen pixels per source pixel. */
  scale: number
  /** Offset from the crop area's center, in screen pixels. */
  x: number
  y: number
  /** Side length of the crop area, in screen pixels. */
  cropSize: number
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Renders the selected square crop, preferring WebP and safely falling back to JPEG. */
export async function renderProfilePhoto(
  image: CanvasImageSource,
  crop: ProfilePhotoCrop,
  quality = 0.88,
): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = PROFILE_PHOTO_SIZE
  canvas.height = PROFILE_PHOTO_SIZE
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Your browser cannot prepare this image.")

  const outputScale = PROFILE_PHOTO_SIZE / crop.cropSize
  const sourceScale = crop.scale * outputScale
  const sourceWidth = image instanceof HTMLImageElement ? image.naturalWidth : 0
  const sourceHeight = image instanceof HTMLImageElement ? image.naturalHeight : 0
  if (!sourceWidth || !sourceHeight) throw new Error("The selected image is not ready.")

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.drawImage(
    image,
    (PROFILE_PHOTO_SIZE - sourceWidth * sourceScale) / 2 + crop.x * outputScale,
    (PROFILE_PHOTO_SIZE - sourceHeight * sourceScale) / 2 + crop.y * outputScale,
    sourceWidth * sourceScale,
    sourceHeight * sourceScale,
  )

  const webp = await canvasBlob(canvas, "image/webp", quality)
  if (webp?.type === "image/webp") return webp

  const jpeg = await canvasBlob(canvas, "image/jpeg", quality)
  if (!jpeg) throw new Error("Your browser could not export this image.")
  return jpeg
}