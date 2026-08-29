package session

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"

	"starwaves-whatsapp-worker/internal/events"
	"starwaves-whatsapp-worker/internal/models"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	waLog "go.mau.fi/whatsmeow/util/log"
)

// SessionManager manages WhatsApp client sessions across multiple users.
type SessionManager struct {
	dataDir  string
	sessions map[string]*models.SessionState
	lock     sync.RWMutex
}

// NewSessionManager creates and initializes a new SessionManager instance.
func NewSessionManager(dataDir string) *SessionManager {
	_ = os.MkdirAll(dataDir, 0755)
	return &SessionManager{
		dataDir:  dataDir,
		sessions: make(map[string]*models.SessionState),
	}
}

// GetDataDir returns the active data directory path.
func (sm *SessionManager) GetDataDir() string {
	return sm.dataDir
}

// Get retrieves an existing session if present.
func (sm *SessionManager) Get(userID string) (*models.SessionState, bool) {
	sm.lock.RLock()
	defer sm.lock.RUnlock()
	sess, ok := sm.sessions[userID]
	return sess, ok
}

// Count returns the number of active sessions.
func (sm *SessionManager) Count() int {
	sm.lock.RLock()
	defer sm.lock.RUnlock()
	return len(sm.sessions)
}

// Delete removes and cleans up a session and its sqlite database.
func (sm *SessionManager) Delete(userID string) {
	sm.lock.Lock()
	sess, ok := sm.sessions[userID]
	delete(sm.sessions, userID)
	sm.lock.Unlock()

	if ok && sess != nil {
		if sess.Client != nil {
			_ = sess.Client.Logout(context.Background())
			sess.Client.Disconnect()
		}
		userDbPath := filepath.Join(sm.dataDir, fmt.Sprintf("wa_%s.db", userID))
		_ = os.Remove(userDbPath)
	}
}

// GetOrCreate retrieves an existing session or initializes a new whatsmeow client session.
func (sm *SessionManager) GetOrCreate(userID string) (*models.SessionState, error) {
	sm.lock.Lock()
	defer sm.lock.Unlock()

	if sess, ok := sm.sessions[userID]; ok {
		return sess, nil
	}

	userDbPath := filepath.Join(sm.dataDir, fmt.Sprintf("wa_%s.db", userID))
	dbLog := waLog.Stdout("Database", "WARN", true)
	container, err := sqlstore.New(context.Background(), "sqlite3", fmt.Sprintf("file:%s?_foreign_keys=on", userDbPath), dbLog)
	if err != nil {
		return nil, fmt.Errorf("failed to init sqlstore: %w", err)
	}

	deviceStore, err := container.GetFirstDevice(context.Background())
	if err != nil {
		return nil, fmt.Errorf("failed to get first device: %w", err)
	}

	clientLog := waLog.Stdout("Client", "INFO", true)
	client := whatsmeow.NewClient(deviceStore, clientLog)

	sess := &models.SessionState{
		Client:    client,
		Device:    deviceStore,
		Container: container,
		Chats:     make(map[string]*models.SessionChat),
		Messages:  make(map[string][]*models.SessionMessage),
	}

	if deviceStore != nil && deviceStore.ID != nil {
		sess.Connected = true
		sess.PhoneNumber = deviceStore.ID.User
		sess.PushName = deviceStore.PushName
	}

	client.AddEventHandler(func(evt interface{}) {
		events.HandleEvent(sess, userID, evt)
	})

	sm.sessions[userID] = sess

	// If device is already logged in, connect automatically in background
	if client.Store.ID != nil {
		go func() {
			if !client.IsConnected() {
				if err := client.Connect(); err != nil {
					log.Printf("[User %s] Auto-connect error: %v", userID, err)
				}
			}
		}()
	}

	return sess, nil
}
