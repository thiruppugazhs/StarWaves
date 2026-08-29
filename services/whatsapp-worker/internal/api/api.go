package api

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	"starwaves-whatsapp-worker/internal/contacts"
	"starwaves-whatsapp-worker/internal/models"
	"starwaves-whatsapp-worker/internal/session"
	"starwaves-whatsapp-worker/internal/webhook"

	"github.com/gin-gonic/gin"
	qrcode "github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

// Handler holds API route handlers and dependencies.
type Handler struct {
	sessions *session.SessionManager
}

// NewHandler creates a new API Handler instance.
func NewHandler(sm *session.SessionManager) *Handler {
	return &Handler{
		sessions: sm,
	}
}

// RegisterRoutes attaches all HTTP endpoints to the Gin router.
func (h *Handler) RegisterRoutes(r *gin.Engine) {
	r.GET("/health", h.Health)
	r.POST("/session/pair", h.Pair)
	r.GET("/session/status/:userId", h.Status)
	r.GET("/session/chats/:userId", h.Chats)
	r.GET("/session/messages/:userId/:chatId", h.Messages)
	r.POST("/session/react", h.React)
	r.POST("/session/send", h.Send)
	r.POST("/session/disconnect", h.Disconnect)
}

// Health returns worker health status and active session count.
func (h *Handler) Health(c *gin.Context) {
	count := h.sessions.Count()
	c.JSON(http.StatusOK, gin.H{
		"status":   "ok",
		"worker":   "whatsmeow",
		"sessions": count,
	})
}

// Pair initiates WhatsApp QR code or phone number pairing code flow.
func (h *Handler) Pair(c *gin.Context) {
	var req struct {
		UserID      string `json:"userId" binding:"required"`
		PhoneNumber string `json:"phoneNumber"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "userId is required"})
		return
	}

	sess, err := h.sessions.GetOrCreate(req.UserID)
	if err != nil {
		log.Printf("[Pair] GetOrCreate failed for %s: %v", req.UserID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	sess.RLock()
	isConnected := sess.Connected || (sess.Client != nil && sess.Client.IsConnected())
	isLoggedIn := sess.Client != nil && sess.Client.IsLoggedIn()
	hasDeviceID := sess.Device != nil && sess.Device.ID != nil
	phoneNum := sess.PhoneNumber
	pushName := sess.PushName
	existingQR := sess.QRCode
	sess.RUnlock()

	if isConnected || isLoggedIn || hasDeviceID {
		// Already paired — frontend should use /session/status instead of re-pairing
		log.Printf("[Pair] user %s already has device %v (connected=%v loggedIn=%v) — returning 200", req.UserID, hasDeviceID, isConnected, isLoggedIn)
		c.JSON(http.StatusOK, gin.H{
			"connected":   true,
			"phoneNumber": phoneNum,
			"pushName":    pushName,
			"qrCode":      existingQR,
		})
		return
	}

	if req.PhoneNumber != "" {
		// Pairing code flow
		cleanPhone := strings.Map(func(r rune) rune {
			if r >= '0' && r <= '9' {
				return r
			}
			return -1
		}, req.PhoneNumber)

		if !sess.Client.IsConnected() {
			_ = sess.Client.Connect()
		}

		code, err := sess.Client.PairPhone(context.Background(), cleanPhone, true, whatsmeow.PairClientChrome, "Chrome (Linux)")
		if err != nil {
			log.Printf("[PairPhone] failed for %s (%s): %v", req.UserID, cleanPhone, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("pairing code failed: %v", err)})
			return
		}
		sess.Lock()
		sess.PairingCode = code
		sess.Unlock()

		c.JSON(http.StatusOK, gin.H{
			"connected":   false,
			"pairingCode": code,
			"qrCode":      "",
		})
		return
	}

	// If existing QR code is already cached in memory, return it directly
	if existingQR != "" {
		c.JSON(http.StatusOK, gin.H{
			"connected": false,
			"qrCode":    existingQR,
		})
		return
	}

	// QR Code Channel flow
	if sess.Client.IsConnected() {
		sess.Client.Disconnect()
	}

	qrChan, err := sess.Client.GetQRChannel(context.Background())
	if err != nil {
		log.Printf("[Pair] GetQRChannel failed for %s: %v", req.UserID, err)
		if existingQR != "" {
			c.JSON(http.StatusOK, gin.H{"connected": false, "qrCode": existingQR})
			return
		}
		// Non-fatal: return 200 so frontend does not retry-storm, includes error for debugging
		c.JSON(http.StatusOK, gin.H{"connected": false, "qrCode": "", "error": fmt.Sprintf("GetQRChannel error: %v", err)})
		return
	}

	if err := sess.Client.Connect(); err != nil {
		log.Printf("[Pair] Connect failed for %s: %v", req.UserID, err)
		if strings.Contains(err.Error(), "already connected") || strings.Contains(err.Error(), "already logged in") {
			c.JSON(http.StatusOK, gin.H{"connected": false, "qrCode": existingQR, "error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("connect error: %v", err)})
		return
	}

	var returnQR string
	qrReceived := make(chan struct{}, 1)

	go func() {
		for evt := range qrChan {
			if evt.Event == "code" {
				pngBytes, err := qrcode.Encode(evt.Code, qrcode.Medium, 256)
				if err == nil {
					qrData := "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngBytes)
					sess.Lock()
					sess.QRCode = qrData
					sess.Unlock()
					log.Printf("[User %s] Real WhatsApp QR code generated successfully (len: %d)", req.UserID, len(qrData))

					// Dispatch webhook to Starwaves FastAPI backend
					webhook.SendWebhookWithTimeout(map[string]interface{}{
						"type":   "qr_update",
						"userId": req.UserID,
						"qrCode": qrData,
					}, 4*time.Second)
				}
				select {
				case qrReceived <- struct{}{}:
				default:
				}
			} else if evt.Event == "success" {
				log.Printf("[User %s] WhatsApp QR scan confirmed successfully", req.UserID)
			}
		}
	}()

	select {
	case <-qrReceived:
		sess.RLock()
		returnQR = sess.QRCode
		sess.RUnlock()
	case <-time.After(5 * time.Second):
		sess.RLock()
		returnQR = sess.QRCode
		sess.RUnlock()
	}

	c.JSON(http.StatusOK, gin.H{
		"connected": sess.Connected,
		"qrCode":    returnQR,
	})
}

// Status returns connection status and session information for a given user.
func (h *Handler) Status(c *gin.Context) {
	userID := c.Param("userId")
	sess, err := h.sessions.GetOrCreate(userID)
	if err != nil || sess == nil {
		c.JSON(http.StatusOK, gin.H{"connected": false, "qrCode": ""})
		return
	}

	sess.RLock()
	defer sess.RUnlock()

	isConnected := sess.Connected || (sess.Client != nil && (sess.Client.IsConnected() || sess.Client.IsLoggedIn()))
	phoneNumber := sess.PhoneNumber
	pushName := sess.PushName
	if phoneNumber == "" && sess.Device != nil && sess.Device.ID != nil {
		phoneNumber = sess.Device.ID.User
		pushName = sess.Device.PushName
	}

	c.JSON(http.StatusOK, gin.H{
		"connected":   isConnected,
		"qrCode":      sess.QRCode,
		"pairingCode": sess.PairingCode,
		"phoneNumber": phoneNumber,
		"pushName":    pushName,
	})
}

// Chats lists chats for the given user, populating from contacts store and enriching in background.
func (h *Handler) Chats(c *gin.Context) {
	userID := c.Param("userId")
	sess, err := h.sessions.GetOrCreate(userID)
	if err != nil || sess == nil {
		c.JSON(http.StatusOK, gin.H{"chats": []interface{}{}})
		return
	}

	sess.RLock()
	var chatList []*models.SessionChat
	for _, chat := range sess.Chats {
		chatList = append(chatList, chat)
	}
	sess.RUnlock()

	// If memory chats is empty or has placeholder names, populate/update from Device Contacts store
	if sess.Device != nil && sess.Device.Contacts != nil {
		contactsStore, err := sess.Device.Contacts.GetAllContacts(context.Background())
		if err == nil {
			sess.Lock()
			for jid, _ := range contactsStore {
				jidStr := jid.String()
				isGroup := strings.HasSuffix(jidStr, "@g.us")
				name := contacts.ResolveChatName(sess, jid, isGroup, "")

				if existing, exists := sess.Chats[jidStr]; !exists {
					sess.Chats[jidStr] = &models.SessionChat{
						ID:          jidStr,
						Name:        name,
						PhoneNumber: jid.User,
						IsGroup:     isGroup,
						UnreadCount: 0,
						UpdatedAt:   time.Time{},
					}
				} else if (existing.Name == "" || existing.Name == "Contact" || existing.Name == jidStr || strings.HasPrefix(existing.Name, "+") || existing.Name == "Susindran") && name != "Contact" && !strings.HasPrefix(name, "+") && (!isGroup || name != "Group conversation") {
					// Update name if real contact name is found
					if jid.User != sess.PhoneNumber || name == sess.PushName+" (You)" || name == "You" {
						existing.Name = name
					}
				}
			}
			sess.Unlock()
		}
	}

	sess.RLock()
	chatList = make([]*models.SessionChat, 0, len(sess.Chats))
	for _, chat := range sess.Chats {
		chatList = append(chatList, chat)
	}
	sess.RUnlock()

	// Sort chats: chats with actual messages first (descending by UpdatedAt)
	sort.Slice(chatList, func(i, j int) bool {
		iHasMsg := chatList[i].LastMessage != "" && !chatList[i].UpdatedAt.IsZero()
		jHasMsg := chatList[j].LastMessage != "" && !chatList[j].UpdatedAt.IsZero()
		if iHasMsg != jHasMsg {
			return iHasMsg
		}
		if !chatList[i].UpdatedAt.Equal(chatList[j].UpdatedAt) {
			return chatList[i].UpdatedAt.After(chatList[j].UpdatedAt)
		}
		return strings.ToLower(chatList[i].Name) < strings.ToLower(chatList[j].Name)
	})

	// Asynchronously enhance uncached chats in the background without blocking HTTP response
	go func(currentSess *models.SessionState, list []*models.SessionChat) {
		if currentSess.Client == nil || !currentSess.Client.IsConnected() {
			return
		}
		for _, chat := range list {
			if chat.AvatarURL == "" || (chat.IsGroup && len(chat.Participants) == 0) {
				parsedJID, err := types.ParseJID(chat.ID)
				if err == nil {
					ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
					if chat.IsGroup || strings.HasSuffix(chat.ID, "@g.us") {
						info, err := currentSess.Client.GetGroupInfo(ctx, parsedJID)
						if err == nil && info != nil {
							currentSess.Lock()
							if info.GroupName.Name != "" {
								chat.Name = info.GroupName.Name
							}
							var pList []string
							for _, p := range info.Participants {
								pName := contacts.ResolveContactName(currentSess, p.JID, "")
								if pName == "Contact" || pName == "+"+p.JID.User || pName == p.JID.User {
									if currentSess.Messages != nil {
										for _, m := range currentSess.Messages[chat.ID] {
											if strings.Contains(m.SenderID, p.JID.User) && m.SenderName != "" && m.SenderName != "Contact" && m.SenderName != "1289" && !strings.HasPrefix(m.SenderName, "+") {
												pName = m.SenderName
												break
											}
										}
									}
								}
								pList = append(pList, pName)
							}
							chat.Participants = pList
							currentSess.Unlock()

							// Notify backend about updated group info
							webhook.SendWebhook(map[string]interface{}{
								"type":     "history_sync",
								"userId":   userID,
								"chats":    []*models.SessionChat{chat},
								"messages": []*models.SessionMessage{},
							})
						}
					}
					// Fetch profile picture URL
					picInfo, err := currentSess.Client.GetProfilePictureInfo(ctx, parsedJID, &whatsmeow.GetProfilePictureParams{
						Preview: true,
					})
					if err == nil && picInfo != nil && picInfo.URL != "" {
						currentSess.Lock()
						chat.AvatarURL = picInfo.URL
						currentSess.Unlock()

						// Sync updated avatar to backend
						webhook.SendWebhook(map[string]interface{}{
							"type":     "history_sync",
							"userId":   userID,
							"chats":    []*models.SessionChat{chat},
							"messages": []*models.SessionMessage{},
						})
					}
					cancel()
				}
			}
		}
	}(sess, chatList)

	c.JSON(http.StatusOK, gin.H{"chats": chatList})
}

// Messages returns chronological message history for a specific chat.
func (h *Handler) Messages(c *gin.Context) {
	userID := c.Param("userId")
	chatID := c.Param("chatId")

	sess, err := h.sessions.GetOrCreate(userID)
	if err != nil || sess == nil {
		c.JSON(http.StatusOK, gin.H{"messages": []interface{}{}})
		return
	}

	sess.RLock()
	msgs := sess.Messages[chatID]
	if len(msgs) == 0 {
		cleanID := strings.Split(chatID, "@")[0]
		for k, v := range sess.Messages {
			if strings.Split(k, "@")[0] == cleanID {
				msgs = v
				break
			}
		}
	}
	if msgs == nil {
		msgs = []*models.SessionMessage{}
	}

	sortedMsgs := make([]*models.SessionMessage, len(msgs))
	copy(sortedMsgs, msgs)
	sort.Slice(sortedMsgs, func(i, j int) bool {
		return sortedMsgs[i].Timestamp.Before(sortedMsgs[j].Timestamp)
	})
	sess.RUnlock()

	c.JSON(http.StatusOK, gin.H{"messages": sortedMsgs})
}

// React sends an emoji reaction to a message.
func (h *Handler) React(c *gin.Context) {
	var req struct {
		UserID    string `json:"userId" binding:"required"`
		ChatID    string `json:"chatId" binding:"required"`
		MessageID string `json:"messageId" binding:"required"`
		Reaction  string `json:"reaction"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sess, ok := h.sessions.Get(req.UserID)
	if !ok || sess == nil || !sess.Connected {
		c.JSON(http.StatusBadRequest, gin.H{"error": "WhatsApp is not connected for this user"})
		return
	}

	targetJID, err := types.ParseJID(req.ChatID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid JID: %v", err)})
		return
	}

	msg := sess.Client.BuildReaction(targetJID, types.EmptyJID, req.MessageID, req.Reaction)
	resp, err := sess.Client.SendMessage(context.Background(), targetJID, msg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("react error: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "messageId": resp.ID})
}

// Send sends an outgoing text message to a WhatsApp chat or phone number.
func (h *Handler) Send(c *gin.Context) {
	var req struct {
		UserID  string `json:"userId" binding:"required"`
		ChatID  string `json:"chatId" binding:"required"`
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sess, err := h.sessions.GetOrCreate(req.UserID)
	if err != nil || sess == nil || sess.Client == nil || !sess.Client.IsConnected() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "WhatsApp is not connected for this user"})
		return
	}

	jidStr := req.ChatID
	if !strings.Contains(jidStr, "@") {
		clean := strings.Map(func(r rune) rune {
			if r >= '0' && r <= '9' {
				return r
			}
			return -1
		}, jidStr)
		jidStr = clean + "@s.whatsapp.net"
	}

	targetJID, err := types.ParseJID(jidStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid JID: %v", err)})
		return
	}

	msg := &waE2E.Message{
		Conversation: proto.String(req.Content),
	}

	resp, err := sess.Client.SendMessage(context.Background(), targetJID, msg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("send error: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"messageId": resp.ID,
		"timestamp": resp.Timestamp.Format(time.RFC3339),
	})
}

// Disconnect logs out and removes the WhatsApp session for the user.
func (h *Handler) Disconnect(c *gin.Context) {
	var req struct {
		UserID string `json:"userId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.sessions.Delete(req.UserID)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "logged out"})
}
