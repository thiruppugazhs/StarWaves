package events

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"strings"
	"time"

	"starwaves-whatsapp-worker/internal/contacts"
	"starwaves-whatsapp-worker/internal/models"
	"starwaves-whatsapp-worker/internal/parser"
	"starwaves-whatsapp-worker/internal/webhook"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
	waEvents "go.mau.fi/whatsmeow/types/events"
)

// HandleEvent dispatches incoming whatsmeow events to appropriate handlers.
func HandleEvent(s *models.SessionState, userID string, evt interface{}) {
	switch v := evt.(type) {
	case *waEvents.HistorySync:
		handleHistorySync(s, userID, v)
	case *waEvents.Connected:
		handleConnected(s, userID, v)
	case *waEvents.LoggedOut:
		handleLoggedOut(s, userID)
	case *waEvents.Message:
		handleMessage(s, userID, v)
	}
}

func handleHistorySync(s *models.SessionState, userID string, v *waEvents.HistorySync) {
	log.Printf("[User %s] Received HistorySync chunk (%s): %d conversations", userID, v.Data.GetSyncType().String(), len(v.Data.GetConversations()))

	var syncedChats []*models.SessionChat
	var syncedMessages []*models.SessionMessage

	s.Lock()
	for _, conv := range v.Data.GetConversations() {
		chatJIDStr := conv.GetID()
		parsedJID, _ := types.ParseJID(chatJIDStr)
		isGroup := strings.HasSuffix(chatJIDStr, "@g.us")
		unread := int(conv.GetUnreadCount())
		rawName := conv.GetName()

		chatName := contacts.ResolveChatName(s, parsedJID, isGroup, rawName)

		lastText := ""
		var lastTime time.Time

		for _, hMsg := range conv.GetMessages() {
			webMsg := hMsg.GetMessage()
			if webMsg == nil {
				continue
			}
			rawM := webMsg.GetMessage()
			if rawM == nil {
				continue
			}

			msgID := ""
			fromMe := false
			senderJID := chatJIDStr
			if key := webMsg.GetKey(); key != nil {
				msgID = key.GetID()
				fromMe = key.GetFromMe()
				if key.GetParticipant() != "" {
					senderJID = key.GetParticipant()
				}
			}

			// Check if this history message is a reaction
			if rxTarget, rxEmoji := parser.ExtractReactionInfo(rawM); rxTarget != "" {
				rxSenderName := ""
				if pJID, err := types.ParseJID(senderJID); err == nil {
					rxSenderName = contacts.ResolveContactName(s, pJID, "")
				}
				for _, existing := range syncedMessages {
					if existing.ID == rxTarget {
						if rxEmoji != "" {
							existing.Reactions = append(existing.Reactions, &models.SessionReaction{
								Emoji:      rxEmoji,
								Sender:     senderJID,
								SenderName: rxSenderName,
								Count:      1,
							})
						}
						break
					}
				}
				continue
			}

			text, isFwd, media, replyToID := parser.ExtractMessageInfo(rawM)
			if text == "" && media == nil {
				continue
			}

			ts := time.Unix(int64(webMsg.GetMessageTimestamp()), 0)
			if text != "" {
				lastText = text
				lastTime = ts
			}

			senderName := ""
			if fromMe {
				senderName = "You"
			} else if isGroup {
				senderName = webMsg.GetPushName()
				if senderName == "" {
					if pJID, err := types.ParseJID(senderJID); err == nil {
						senderName = contacts.ResolveContactName(s, pJID, "")
					} else {
						senderName = senderJID
					}
				}
			} else {
				// 1-on-1 chat: sender is the contact
				if push := webMsg.GetPushName(); push != "" {
					senderName = push
					if chatName == "Contact" || strings.HasPrefix(chatName, "+") {
						chatName = push
					}
				} else {
					senderName = chatName
				}
			}

			// Decrypt and download full-res media if available
			if media != nil && s.Client != nil {
				if downloadable, mime := parser.ExtractDownloadableMessage(rawM); downloadable != nil {
					if dlMsg, ok := downloadable.(whatsmeow.DownloadableMessage); ok {
						ctxDl, cancelDl := context.WithTimeout(context.Background(), 3*time.Second)
						data, err := s.Client.Download(ctxDl, dlMsg)
						cancelDl()
						if err == nil && len(data) > 0 {
							if mime == "" {
								mime = "image/jpeg"
							}
							media.URL = fmt.Sprintf("data:%s;base64,%s", mime, base64.StdEncoding.EncodeToString(data))
						}
					}
				}
			}

			m := &models.SessionMessage{
				ID:               msgID,
				ChatID:           chatJIDStr,
				SenderID:         senderJID,
				SenderName:       senderName,
				IsFromMe:         fromMe,
				IsForwarded:      isFwd,
				Content:          text,
				Media:            media,
				ReplyToMessageID: replyToID,
				Timestamp:        ts,
				Status:           "delivered",
			}
			s.Messages[chatJIDStr] = append(s.Messages[chatJIDStr], m)
			syncedMessages = append(syncedMessages, m)
		}

		chat := &models.SessionChat{
			ID:          chatJIDStr,
			Name:        chatName,
			PhoneNumber: parsedJID.User,
			IsGroup:     isGroup,
			UnreadCount: unread,
			LastMessage: lastText,
			UpdatedAt:   lastTime,
		}
		s.Chats[chatJIDStr] = chat
		syncedChats = append(syncedChats, chat)
	}
	s.Unlock()

	// Forward history sync batch to FastAPI backend
	webhook.SendWebhookWithTimeout(map[string]interface{}{
		"type":     "history_sync",
		"userId":   userID,
		"chats":    syncedChats,
		"messages": syncedMessages,
	}, 10*time.Second)
}

func handleConnected(s *models.SessionState, userID string, _ *waEvents.Connected) {
	s.Lock()
	s.Connected = true
	s.QRCode = ""
	if s.Client != nil && s.Client.Store != nil && s.Client.Store.ID != nil {
		s.PhoneNumber = s.Client.Store.ID.User
		s.PushName = s.Client.Store.PushName
	}
	phone := s.PhoneNumber
	push := s.PushName
	s.Unlock()
	log.Printf("[User %s] WhatsApp Connected: %s (%s)", userID, phone, push)

	// Fetch joined groups to populate accurate group subjects/names
	go func() {
		if s.Client == nil {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		groups, err := s.Client.GetJoinedGroups(ctx)
		if err == nil && len(groups) > 0 {
			var syncedGroups []*models.SessionChat
			s.Lock()
			for _, g := range groups {
				jidStr := g.JID.String()
				var pList []string
				for _, p := range g.Participants {
					pList = append(pList, p.JID.User)
				}
				groupName := g.GroupName.Name
				if groupName == "" {
					groupName = "Group conversation"
				}
				if existing, ok := s.Chats[jidStr]; ok {
					existing.Name = groupName
					existing.IsGroup = true
					existing.Participants = pList
					syncedGroups = append(syncedGroups, existing)
				} else {
					newGroup := &models.SessionChat{
						ID:           jidStr,
						Name:         groupName,
						IsGroup:      true,
						Participants: pList,
						UnreadCount:  0,
						UpdatedAt:    time.Time{},
					}
					s.Chats[jidStr] = newGroup
					syncedGroups = append(syncedGroups, newGroup)
				}
			}
			s.Unlock()

			if len(syncedGroups) > 0 {
				webhook.SendWebhook(map[string]interface{}{
					"type":     "history_sync",
					"userId":   userID,
					"chats":    syncedGroups,
					"messages": []*models.SessionMessage{},
				})
			}
		}
	}()

	// Also notify backend that WhatsApp is now connected
	webhook.SendWebhook(map[string]interface{}{
		"type":        "status_update",
		"userId":      userID,
		"connected":   true,
		"phoneNumber": phone,
		"pushName":    push,
	})
}

func handleLoggedOut(s *models.SessionState, userID string) {
	s.Lock()
	s.Connected = false
	s.QRCode = ""
	s.PhoneNumber = ""
	s.PushName = ""
	s.Unlock()
	log.Printf("[User %s] WhatsApp Logged Out", userID)
}

func handleMessage(s *models.SessionState, userID string, v *waEvents.Message) {
	senderJID := v.Info.Sender.String()
	chatJID := v.Info.Chat.String()
	isFromMe := v.Info.IsFromMe
	isGroup := v.Info.IsGroup || strings.HasSuffix(chatJID, "@g.us")
	parsedChatJID, _ := types.ParseJID(chatJID)

	senderName := ""
	senderAvatar := ""
	if isFromMe {
		senderName = "You"
	} else {
		senderName = contacts.ResolveContactName(s, v.Info.Sender, v.Info.PushName)
		senderAvatar = contacts.ResolveAvatarURL(s, v.Info.Sender)
	}

	// Check if message is a reaction
	if rxTarget, rxEmoji := parser.ExtractReactionInfo(v.Message); rxTarget != "" {
		s.Lock()
		if msgs, ok := s.Messages[chatJID]; ok {
			for _, m := range msgs {
				if m.ID == rxTarget {
					var filtered []*models.SessionReaction
					for _, r := range m.Reactions {
						if r.Sender != senderName && r.Sender != senderJID {
							filtered = append(filtered, r)
						}
					}
					if rxEmoji != "" {
						filtered = append(filtered, &models.SessionReaction{
							Emoji:      rxEmoji,
							Sender:     senderJID,
							SenderName: senderName,
							Count:      1,
						})
					}
					m.Reactions = filtered
					break
				}
			}
		}
		s.Unlock()

		webhook.SendWebhook(map[string]interface{}{
			"type":       "message_reaction",
			"userId":     userID,
			"chatId":     chatJID,
			"messageId":  rxTarget,
			"senderId":   senderJID,
			"senderName": senderName,
			"emoji":      rxEmoji,
		})
		return
	}

	text, isFwd, media, replyToID := parser.ExtractMessageInfo(v.Message)
	if text == "" && media == nil {
		return
	}

	// If message has media and client is available, decrypt and download the full-resolution content
	if media != nil && s.Client != nil {
		if downloadable, mime := parser.ExtractDownloadableMessage(v.Message); downloadable != nil {
			if dlMsg, ok := downloadable.(whatsmeow.DownloadableMessage); ok {
				// Quick download with timeout
				ctxDl, cancelDl := context.WithTimeout(context.Background(), 5*time.Second)
				data, err := s.Client.Download(ctxDl, dlMsg)
				cancelDl()
				if err == nil && len(data) > 0 {
					if mime == "" {
						mime = "image/jpeg"
					}
					dataURI := fmt.Sprintf("data:%s;base64,%s", mime, base64.StdEncoding.EncodeToString(data))
					media.URL = dataURI
					log.Printf("[User %s] Successfully decrypted full-res media for message %s (%d bytes)", userID, v.Info.ID, len(data))
				} else if err != nil {
					log.Printf("[User %s] Could not download media for message %s: %v", userID, v.Info.ID, err)
				}
			}
		}
	}

	s.Lock()
	msg := &models.SessionMessage{
		ID:               v.Info.ID,
		ChatID:           chatJID,
		SenderID:         senderJID,
		SenderName:       senderName,
		SenderAvatarURL:  senderAvatar,
		IsFromMe:         isFromMe,
		IsForwarded:      isFwd,
		Content:          text,
		Media:            media,
		ReplyToMessageID: replyToID,
		Timestamp:        v.Info.Timestamp,
		Status:           "delivered",
	}
	s.Messages[chatJID] = append(s.Messages[chatJID], msg)

	chatName := ""
	if chat, ok := s.Chats[chatJID]; ok {
		chat.LastMessage = text
		chat.UpdatedAt = v.Info.Timestamp
		// If existing chat name was just fallback, try to resolve it now
		if chat.Name == "" || chat.Name == "Contact" || chat.Name == chatJID || strings.HasPrefix(chat.Name, "+") {
			resolved := contacts.ResolveChatName(s, parsedChatJID, isGroup, "")
			if resolved != "Contact" && !strings.HasPrefix(resolved, "+") {
				chat.Name = resolved
			}
		}
		chatName = chat.Name
	} else {
		// New chat: Resolve proper chat name (NOT the sender name when isFromMe is true)
		resolvedName := contacts.ResolveChatName(s, parsedChatJID, isGroup, "")
		if !isGroup && !isFromMe && senderName != "" && senderName != "Contact" && (resolvedName == "Contact" || strings.HasPrefix(resolvedName, "+")) {
			resolvedName = senderName
		}
		chatName = resolvedName
		newChat := &models.SessionChat{
			ID:          chatJID,
			Name:        resolvedName,
			PhoneNumber: parsedChatJID.User,
			IsGroup:     isGroup,
			UnreadCount: 1,
			LastMessage: text,
			UpdatedAt:   v.Info.Timestamp,
		}
		s.Chats[chatJID] = newChat

		// If it's a group with no resolved name yet, eagerly fetch group info
		if isGroup && s.Client != nil {
			go func(targetJID types.JID, c *models.SessionChat) {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				defer cancel()
				info, err := s.Client.GetGroupInfo(ctx, targetJID)
				if err == nil && info != nil && info.GroupName.Name != "" {
					s.Lock()
					c.Name = info.GroupName.Name
					s.Unlock()
					// Notify backend of updated group name
					webhook.SendWebhook(map[string]interface{}{
						"type":     "history_sync",
						"userId":   userID,
						"chats":    []*models.SessionChat{c},
						"messages": []*models.SessionMessage{},
					})
				}
			}(v.Info.Chat, newChat)
		}
	}
	s.Unlock()

	log.Printf("[User %s] New message from %s in %s (%s): %s", userID, senderName, chatJID, chatName, text)

	webhook.SendWebhook(map[string]interface{}{
		"type":             "new_message",
		"userId":           userID,
		"chatId":           chatJID,
		"chatName":         chatName,
		"isGroup":          isGroup,
		"senderId":         senderJID,
		"senderName":       senderName,
		"senderAvatarUrl":  senderAvatar,
		"isFromMe":         isFromMe,
		"isForwarded":      isFwd,
		"content":          text,
		"media":            media,
		"replyToMessageId": replyToID,
		"messageId":        v.Info.ID,
		"timestamp":        v.Info.Timestamp.Format(time.RFC3339),
	})
}
