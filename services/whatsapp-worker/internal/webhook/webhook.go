package webhook

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"time"
)

// GetBackendWebhookURL returns the configured backend webhook URL.
func GetBackendWebhookURL() string {
	url := os.Getenv("BACKEND_WEBHOOK_URL")
	if url == "" {
		return "http://127.0.0.1:8000/api/v1/whatsapp/webhook"
	}
	return url
}

// SendWebhook asynchronously sends a JSON webhook payload to the backend with default timeout.
func SendWebhook(payload interface{}) {
	SendWebhookWithTimeout(payload, 5*time.Second)
}

// SendWebhookWithTimeout asynchronously sends a JSON webhook payload with custom timeout.
func SendWebhookWithTimeout(payload interface{}, timeout time.Duration) {
	go func() {
		jsonBytes, err := json.Marshal(payload)
		if err != nil {
			return
		}
		url := GetBackendWebhookURL()
		req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBytes))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		if secret := os.Getenv("WHATSAPP_WORKER_SECRET"); secret != "" {
			mac := hmac.New(sha256.New, []byte(secret))
			mac.Write(jsonBytes)
			req.Header.Set("X-Worker-Signature", hex.EncodeToString(mac.Sum(nil)))
		}
		client := &http.Client{Timeout: timeout}
		_, _ = client.Do(req)
	}()
}
