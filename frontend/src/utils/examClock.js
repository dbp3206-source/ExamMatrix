export function examDeadline(remainingSeconds, receivedAt) {
  if (remainingSeconds == null || remainingSeconds === '') {
    throw new Error('Máy chủ không trả thời gian làm bài.')
  }
  const seconds = Number(remainingSeconds)
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error('Máy chủ không trả thời gian làm bài hợp lệ.')
  }
  return receivedAt + seconds * 1000
}

export function displayedSeconds(deadline, now) {
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}
