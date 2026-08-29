package parser

import (
	"testing"

	"go.mau.fi/whatsmeow/proto/waCommon"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"google.golang.org/protobuf/proto"
)

func TestUnwrapMessage(t *testing.T) {
	if UnwrapMessage(nil) != nil {
		t.Fatal("expected nil for nil input")
	}

	inner := &waE2E.Message{
		Conversation: proto.String("hello world"),
	}
	ephemeral := &waE2E.Message{
		EphemeralMessage: &waE2E.FutureProofMessage{
			Message: inner,
		},
	}

	unwrapped := UnwrapMessage(ephemeral)
	if unwrapped == nil || unwrapped.GetConversation() != "hello world" {
		t.Fatalf("expected 'hello world', got %v", unwrapped)
	}
}

func TestExtractMessageInfo(t *testing.T) {
	msg := &waE2E.Message{
		Conversation: proto.String("test message"),
	}

	content, isFwd, media, replyToID := ExtractMessageInfo(msg)
	if content != "test message" {
		t.Fatalf("expected content 'test message', got '%s'", content)
	}
	if isFwd {
		t.Fatal("expected isForwarded false")
	}
	if media != nil {
		t.Fatal("expected media nil")
	}
	if replyToID != "" {
		t.Fatalf("expected empty replyToID, got '%s'", replyToID)
	}
}

func TestExtractReactionInfo(t *testing.T) {
	targetID := "msg-123"
	emoji := "❤️"
	msg := &waE2E.Message{
		ReactionMessage: &waE2E.ReactionMessage{
			Key: &waCommon.MessageKey{
				ID: proto.String(targetID),
			},
			Text: proto.String(emoji),
		},
	}

	resID, resEmoji := ExtractReactionInfo(msg)
	if resID != targetID {
		t.Fatalf("expected targetID '%s', got '%s'", targetID, resID)
	}
	if resEmoji != emoji {
		t.Fatalf("expected emoji '%s', got '%s'", emoji, resEmoji)
	}
}
