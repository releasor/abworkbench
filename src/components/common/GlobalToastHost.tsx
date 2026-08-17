import { useEffect } from 'react'
import { Toast } from '../../modules/taskflow/components/Toast'
import { onToast } from '../../modules/taskflow/utils/toastEvent'
import { useToast } from '../../modules/taskflow/hooks/useToast'

/** App-wide toast host so showToast() works on every page, not only TaskFlow. */
export default function GlobalToastHost() {
  const { toast, show, clear } = useToast()

  useEffect(() => onToast((message, type, action) => show(message, type, action)), [show])

  if (!toast) return null
  return (
    <Toast
      key={toast.id}
      message={toast.message}
      type={toast.type}
      action={toast.action}
      onClose={clear}
    />
  )
}
