export type OcrStatus = { progress: number; status: string }

export async function preprocessImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const maxSide = 1600
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return file
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let index = 0; index < image.data.length; index += 4) {
    const gray = image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114
    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128))
    image.data[index] = contrast
    image.data[index + 1] = contrast
    image.data[index + 2] = contrast
  }
  context.putImageData(image, 0, 0)
  return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), 'image/png', 0.92))
}

export async function runOcr(file: File, onStatus: (status: OcrStatus) => void, signal?: AbortSignal) {
  const { createWorker } = await import('tesseract.js')
  const image = await preprocessImage(file)
  const worker = await createWorker('eng', 1, {
    workerPath: `${import.meta.env.BASE_URL}tesseract/worker.min.js`,
    corePath: `${import.meta.env.BASE_URL}tesseract/tesseract-core.wasm.js`,
    langPath: `${import.meta.env.BASE_URL}tesseract`,
    logger: (message) => onStatus({ progress: message.progress ?? 0, status: message.status ?? '识别中' }),
  })
  const abort = async () => {
    await worker.terminate()
  }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const result = await worker.recognize(image)
    return result.data.text
  } finally {
    signal?.removeEventListener('abort', abort)
    await worker.terminate()
  }
}
