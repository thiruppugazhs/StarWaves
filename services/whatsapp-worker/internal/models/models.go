package models

import (
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
)

// SessionChat represents a single WhatsApp chat/conversation metadata.
type SessionChat struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	PhoneNumber  string    `json:"phoneNumber,omitempty"`
	AvatarURL    string    `json:"avatarUrl,omitempty"`
	IsGroup      bool      `json:"isGroup"`
	Participants []string  `json:"participants,omitempty"`
	UnreadCount  int       `json:"unreadCount"`
	LastMessage  string    `json:"lastMessage"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// SessionMedia holds media attachments in a message.
type SessionMedia struct {
	Type            string  `json:"type"`
	URL             string  `json:"url,omitempty"`
	MimeType        string  `json:"mime_type,omitempty"`
	Filename        string  `json:"filename,omitempty"`
	ThumbnailBase64 string  `json:"thumbnail_base64,omitempty"`
	FileSize        int64   `json:"file_size,omitempty"`
	DurationSeconds float64 `json:"duration_seconds,omitempty"`
}

// SessionReaction represents an emoji reaction on a message.
type SessionReaction struct {
	Emoji      string `json:"emoji"`
	Sender     string `json:"sender"`
	SenderName string `json:"senderName,omitempty"`
	Count      int    `json:"count"`
}

// SessionMessage represents a single message in a WhatsApp chat.
type SessionMessage struct {
	ID               string             `json:"id"`
	ChatID           string             `json:"chatId"`
	SenderID         string             `json:"senderId"`
	SenderName       string             `json:"senderName"`
	SenderAvatarURL  string             `json:"senderAvatarUrl,omitempty"`
	IsFromMe         bool               `json:"isFromMe"`
	IsForwarded      bool               `json:"isForwarded"`
	Content          string             `json:"content"`
	Media            *SessionMedia      `json:"media,omitempty"`
	ReplyToMessageID string             `json:"replyToMessageId,omitempty"`
	Reactions        []*SessionReaction `json:"reactions,omitempty"`
	Timestamp        time.Time          `json:"timestamp"`
	Status           string             `json:"status"`
}

// SessionState encapsulates live whatsmeow client state, device data, and chat caches for a user.
type SessionState struct {
	Client      *whatsmeow.Client
	Device      *store.Device
	Container   *sqlstore.Container
	QRCode      string
	PairingCode string
	Connected   bool
	PhoneNumber string
	PushName    string
	Chats       map[string]*SessionChat
	Messages    map[string][]*SessionMessage
	AvatarCache map[string]string
	sync.RWMutex
}
