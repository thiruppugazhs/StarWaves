import { useCallback, useEffect, useState } from 'react'
import {
  fetchWhatsAppChats,
  fetchWhatsAppStatus,
  initiateWhatsAppPairing,
} from '../../lib'

export function useWhatsAppPairing({
  status,
  setStatus,
  setChats,
  setSelectedChatId,
  isQrModalOpen,
  setIsQrModalOpen,
}) {
  const [pairingData, setPairingData] = useState({ qr_code: null, pairing_code: null })
  const [isQrLoading, setIsQrLoading] = useState(false)

  useEffect(() => {
    if (!isQrModalOpen || status.connected) return

    const timer = setInterval(async () => {
      try {
        const stat = await fetchWhatsAppStatus()
        if (stat.connected) {
          setStatus(stat)
          setIsQrModalOpen(false)
          const chatList = await fetchWhatsAppChats().catch(() => [])
          setChats(chatList)
          if (chatList.length > 0) setSelectedChatId((curr) => curr || chatList[0].id)
        } else if (!pairingData.qr_code && !pairingData.pairing_code) {
          const pair = await initiateWhatsAppPairing().catch(() => null)
          if (pair?.qr_code || pair?.pairing_code) {
            setPairingData(pair)
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 2000)

    return () => clearInterval(timer)
  }, [isQrModalOpen, status.connected, pairingData.qr_code, pairingData.pairing_code, setChats, setIsQrModalOpen, setSelectedChatId, setStatus])

  const handleQrUpdate = useCallback((qr_code, pairing_code) => {
    setPairingData({
      qr_code,
      pairing_code,
    })
  }, [])

  const handleOpenQrModal = async () => {
    setIsQrModalOpen(true)
    setIsQrLoading(true)
    try {
      const pair = await initiateWhatsAppPairing()
      setPairingData(pair)
    } catch (err) {
      console.error('Pairing error:', err)
    } finally {
      setIsQrLoading(false)
    }
  }

  const handleRequestPairingCode = async (phoneNumber) => {
    try {
      const pair = await initiateWhatsAppPairing(phoneNumber)
      setPairingData((prev) => ({
        ...prev,
        pairing_code: pair.pairing_code,
        qr_code: pair.qr_code || prev.qr_code,
      }))
      return pair
    } catch (err) {
      console.error('Request pairing code error:', err)
      throw err
    }
  }

  const handleCheckStatus = async () => {
    setIsQrLoading(true)
    try {
      const stat = await fetchWhatsAppStatus()
      setStatus(stat)
      if (stat.connected) {
        setIsQrModalOpen(false)
        const chatList = await fetchWhatsAppChats().catch(() => [])
        setChats(chatList)
        if (chatList.length > 0) setSelectedChatId((curr) => curr || chatList[0].id)
      } else {
        const pair = await initiateWhatsAppPairing()
        setPairingData(pair)
      }
    } catch (err) {
      console.error('Check status error:', err)
    } finally {
      setIsQrLoading(false)
    }
  }

  return {
    pairingData,
    isQrLoading,
    handleQrUpdate,
    handleOpenQrModal,
    handleRequestPairingCode,
    handleCheckStatus,
  }
}
