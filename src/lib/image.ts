/** Center-crops an image file to the w:h ratio, scales it down to at most w×h and encodes it as JPEG. */
export async function toJpeg(file: Blob, w: number, h: number): Promise<Blob> {
  const img = await createImageBitmap(file).catch(() => {
    throw new Error('This image format is not supported. Try a JPEG or PNG.')
  })
  const ratio = w / h
  const sw = Math.min(img.width, img.height * ratio)
  const sh = sw / ratio
  const outW = Math.round(Math.min(w, sw))
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = Math.round(outW / ratio)
  canvas.getContext('2d')!.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height)
  img.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the image.'))), 'image/jpeg', 0.85),
  )
}
