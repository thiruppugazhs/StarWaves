package contacts

import (
	"context"
	"strings"
	"time"

	"starwaves-whatsapp-worker/internal/models"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
)

// ResolveContactName resolves a human-readable display name for a contact JID.
func ResolveContactName(s *models.SessionState, jid types.JID, pushName string) string {
	if pushName != "" {
		return pushName
	}
	if s != nil && s.Client != nil && s.Client.Store != nil && s.Client.Store.Contacts != nil {
		if contact, err := s.Client.Store.Contacts.GetContact(context.Background(), jid); err == nil && contact.Found {
			if contact.FullName != "" {
				return contact.FullName
			}
			if contact.PushName != "" {
				return contact.PushName
			}
			if contact.BusinessName != "" {
				return contact.BusinessName
			}
		}
	}
	if jid.User != "" {
		return "+" + jid.User
	}
	return "Contact"
}

// ResolveChatName resolves the accurate display name for a chat (1-on-1 contact, self-chat, or group).
func ResolveChatName(s *models.SessionState, chatJID types.JID, isGroup bool, rawName string) string {
	if isGroup {
		if rawName != "" && rawName != "Contact" && rawName != chatJID.String() {
			return rawName
		}
		return "Group conversation"
	}

	// Check if this is a self-chat (chat with user's own phone number)
	if s != nil && s.Device != nil && s.Device.ID != nil && s.Device.ID.User != "" {
		if chatJID.User == s.Device.ID.User {
			if s.PushName != "" {
				return s.PushName + " (You)"
			}
			return "You"
		}
	}

	// Look up contact in WhatsMeow contact store (populated from phone address book)
	if s != nil && s.Client != nil && s.Client.Store != nil && s.Client.Store.Contacts != nil {
		if contact, err := s.Client.Store.Contacts.GetContact(context.Background(), chatJID); err == nil && contact.Found {
			if contact.FullName != "" {
				return contact.FullName
			}
			if contact.PushName != "" {
				return contact.PushName
			}
			if contact.BusinessName != "" {
				return contact.BusinessName
			}
		}
	}

	if rawName != "" && rawName != "Contact" && rawName != chatJID.String() && !strings.HasSuffix(rawName, "@s.whatsapp.net") {
		return rawName
	}

	if chatJID.User != "" {
		return "+" + chatJID.User
	}
	return "Contact"
}

// ResolveAvatarURL fetches and caches a preview avatar URL for a given contact JID.
func ResolveAvatarURL(s *models.SessionState, jid types.JID) string {
	if s == nil || s.Client == nil || !s.Client.IsConnected() {
		return ""
	}
	s.RLock()
	if s.AvatarCache != nil {
		if url, ok := s.AvatarCache[jid.String()]; ok {
			s.RUnlock()
			return url
		}
	}
	s.RUnlock()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	picInfo, err := s.Client.GetProfilePictureInfo(ctx, jid, &whatsmeow.GetProfilePictureParams{
		Preview: true,
	})
	if err == nil && picInfo != nil && picInfo.URL != "" {
		s.Lock()
		if s.AvatarCache == nil {
			s.AvatarCache = make(map[string]string)
		}
		s.AvatarCache[jid.String()] = picInfo.URL
		s.Unlock()
		return picInfo.URL
	}
	return ""
}
