export const formatDate = (value) => value
  ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : '—'

export const formatDateTime = formatDate

export const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`

const HTTP_STATUS_FALLBACKS = {
  401: 'Yêu cầu chưa được xác thực hoặc phiên đã hết hạn (401).',
  403: 'Bạn không có quyền thực hiện thao tác này (403).',
  409: 'Dữ liệu bị xung đột hoặc đã tồn tại (409).',
  423: 'Tài khoản đã bị khóa (423).',
  503: 'Dịch vụ chưa được cấu hình hoặc tạm thời không khả dụng (503).',
}

export const normalizeError = (error) => {
  const serverMessage = error?.response?.data?.message
  const status = error?.response?.status ?? error?.status
  const fallback = status ? HTTP_STATUS_FALLBACKS[status] : null
  return {
    message: serverMessage || fallback || error?.message || 'Đã có lỗi xảy ra',
    fieldErrors: error?.response?.data?.fieldErrors || error?.fieldErrors || {},
  }
}
