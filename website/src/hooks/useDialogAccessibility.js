import { useEffect } from 'react'

const focusableSelector =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useDialogAccessibility() {
  useEffect(() => {
    let activeDialog = null
    let previouslyFocused = null
    let inertedElements = []

    const clearDialog = () => {
      inertedElements.forEach((element) => element.removeAttribute('inert'))
      inertedElements = []
      activeDialog = null
      previouslyFocused?.focus?.()
      previouslyFocused = null
    }

    const containBackground = (dialog) => {
      let current = dialog
      while (current.parentElement && current.parentElement !== document.body) {
        Array.from(current.parentElement.children).forEach((sibling) => {
          if (sibling === current || sibling.hasAttribute('inert')) return
          sibling.setAttribute('inert', '')
          inertedElements.push(sibling)
        })
        current = current.parentElement
      }
    }

    const activateDialog = (dialog) => {
      if (activeDialog === dialog) return
      clearDialog()
      activeDialog = dialog
      previouslyFocused = document.activeElement
      if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1')
      containBackground(dialog)
      window.requestAnimationFrame(() => {
        const initialFocus =
          dialog.querySelector('[autofocus], [data-modal-initial-focus]') ||
          dialog.querySelector(focusableSelector) ||
          dialog
        initialFocus.focus()
      })
    }

    const syncDialog = () => {
      const dialogs = Array.from(
        document.querySelectorAll('[role="dialog"][aria-modal="true"]'),
      ).filter((dialog) => dialog.dataset.dialogManaged !== 'true')
      const nextDialog = dialogs.at(-1) ?? null
      if (nextDialog) activateDialog(nextDialog)
      else if (activeDialog) clearDialog()
    }

    const handleKeyDown = (event) => {
      if (!activeDialog || event.key !== 'Tab') return
      const focusable = Array.from(
        activeDialog.querySelectorAll(focusableSelector),
      )
      if (!focusable.length) {
        event.preventDefault()
        activeDialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const observer = new MutationObserver(syncDialog)
    observer.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('keydown', handleKeyDown)
    syncDialog()

    return () => {
      observer.disconnect()
      document.removeEventListener('keydown', handleKeyDown)
      clearDialog()
    }
  }, [])
}
