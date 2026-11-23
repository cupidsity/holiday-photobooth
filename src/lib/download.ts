function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('could not encode the strip'))
    }, 'image/png')
  })
}

function fileName(): string {
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('')
  return `photostrip-${stamp}.png`
}

export async function saveStrip(canvas: HTMLCanvasElement): Promise<'saved' | 'opened'> {
  const blob = await canvasToBlob(canvas)
  const name = fileName()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // ios safari ignores the download attribute, so hand the blob url back as a
  // tab the guest can long-press to save
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return 'saved'
}

export function canShareStrip(): boolean {
  return typeof navigator.canShare === 'function' && typeof navigator.share === 'function'
}

export async function shareStrip(canvas: HTMLCanvasElement, text: string): Promise<boolean> {
  if (!canShareStrip()) return false
  const blob = await canvasToBlob(canvas)
  const file = new File([blob], fileName(), { type: 'image/png' })
  if (!navigator.canShare({ files: [file] })) return false
  try {
    await navigator.share({ files: [file], text })
    return true
  } catch {
    // the guest backed out of the share sheet
    return false
  }
}
