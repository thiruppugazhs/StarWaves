package parser

import (
	"encoding/base64"

	"starwaves-whatsapp-worker/internal/models"

	"go.mau.fi/whatsmeow/proto/waE2E"
)

// UnwrapMessage unwraps ephemeral, view-once, and caption-wrapped messages.
func UnwrapMessage(msg *waE2E.Message) *waE2E.Message {
	if msg == nil {
		return nil
	}
	if msg.EphemeralMessage != nil && msg.EphemeralMessage.Message != nil {
		return UnwrapMessage(msg.EphemeralMessage.Message)
	}
	if msg.ViewOnceMessage != nil && msg.ViewOnceMessage.Message != nil {
		return UnwrapMessage(msg.ViewOnceMessage.Message)
	}
	if msg.ViewOnceMessageV2 != nil && msg.ViewOnceMessageV2.Message != nil {
		return UnwrapMessage(msg.ViewOnceMessageV2.Message)
	}
	if msg.DocumentWithCaptionMessage != nil && msg.DocumentWithCaptionMessage.Message != nil {
		return UnwrapMessage(msg.DocumentWithCaptionMessage.Message)
	}
	return msg
}

// ExtractReactionInfo extracts target message ID and emoji string from a reaction message.
func ExtractReactionInfo(rawMsg *waE2E.Message) (targetID string, emoji string) {
	if rawMsg == nil {
		return "", ""
	}
	msg := UnwrapMessage(rawMsg)
	if msg == nil {
		return "", ""
	}
	if rx := msg.GetReactionMessage(); rx != nil {
		targetID = ""
		if key := rx.GetKey(); key != nil {
			targetID = key.GetID()
		}
		emoji = rx.GetText()
		return targetID, emoji
	}
	return "", ""
}

// ExtractDownloadableMessage extracts the whatsmeow DownloadableMessage interface if available.
func ExtractDownloadableMessage(rawMsg *waE2E.Message) (interface{}, string) {
	if rawMsg == nil {
		return nil, ""
	}
	msg := UnwrapMessage(rawMsg)
	if msg == nil {
		return nil, ""
	}

	if img := msg.GetImageMessage(); img != nil {
		return img, img.GetMimetype()
	} else if vid := msg.GetVideoMessage(); vid != nil {
		return vid, vid.GetMimetype()
	} else if sticker := msg.GetStickerMessage(); sticker != nil {
		return sticker, sticker.GetMimetype()
	} else if aud := msg.GetAudioMessage(); aud != nil {
		return aud, aud.GetMimetype()
	} else if doc := msg.GetDocumentMessage(); doc != nil {
		return doc, doc.GetMimetype()
	}
	return nil, ""
}

// ExtractMessageInfo extracts content text, forward status, media metadata, and reply ID from a raw message.
func ExtractMessageInfo(rawMsg *waE2E.Message) (content string, isForwarded bool, media *models.SessionMedia, replyToID string) {
	if rawMsg == nil {
		return "", false, nil, ""
	}
	msg := UnwrapMessage(rawMsg)
	if msg == nil {
		return "", false, nil, ""
	}

	var ctxInfo *waE2E.ContextInfo

	if ext := msg.GetExtendedTextMessage(); ext != nil {
		content = ext.GetText()
		ctxInfo = ext.GetContextInfo()
		if len(ext.GetJPEGThumbnail()) > 0 {
			media = &models.SessionMedia{
				Type:            "image",
				ThumbnailBase64: "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(ext.GetJPEGThumbnail()),
			}
		}
	} else if conv := msg.Conversation; conv != nil && *conv != "" {
		content = *conv
	} else if img := msg.GetImageMessage(); img != nil {
		content = img.GetCaption()
		ctxInfo = img.GetContextInfo()
		thumb := ""
		if len(img.GetJPEGThumbnail()) > 0 {
			thumb = "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(img.GetJPEGThumbnail())
		}
		media = &models.SessionMedia{
			Type:            "image",
			URL:             img.GetURL(),
			MimeType:        img.GetMimetype(),
			ThumbnailBase64: thumb,
			FileSize:        int64(img.GetFileLength()),
		}
	} else if vid := msg.GetVideoMessage(); vid != nil {
		content = vid.GetCaption()
		ctxInfo = vid.GetContextInfo()
		thumb := ""
		if len(vid.GetJPEGThumbnail()) > 0 {
			thumb = "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(vid.GetJPEGThumbnail())
		}
		mediaType := "video"
		if vid.GetGifPlayback() {
			mediaType = "gif"
		}
		media = &models.SessionMedia{
			Type:            mediaType,
			URL:             vid.GetURL(),
			MimeType:        vid.GetMimetype(),
			ThumbnailBase64: thumb,
			FileSize:        int64(vid.GetFileLength()),
			DurationSeconds: float64(vid.GetSeconds()),
		}
	} else if sticker := msg.GetStickerMessage(); sticker != nil {
		ctxInfo = sticker.GetContextInfo()
		thumb := ""
		if len(sticker.GetPngThumbnail()) > 0 {
			thumb = "data:image/png;base64," + base64.StdEncoding.EncodeToString(sticker.GetPngThumbnail())
		}
		media = &models.SessionMedia{
			Type:            "sticker",
			URL:             sticker.GetURL(),
			MimeType:        sticker.GetMimetype(),
			ThumbnailBase64: thumb,
			FileSize:        int64(sticker.GetFileLength()),
		}
	} else if aud := msg.GetAudioMessage(); aud != nil {
		ctxInfo = aud.GetContextInfo()
		media = &models.SessionMedia{
			Type:            "audio",
			URL:             aud.GetURL(),
			MimeType:        aud.GetMimetype(),
			FileSize:        int64(aud.GetFileLength()),
			DurationSeconds: float64(aud.GetSeconds()),
		}
	} else if doc := msg.GetDocumentMessage(); doc != nil {
		content = doc.GetCaption()
		ctxInfo = doc.GetContextInfo()
		thumb := ""
		if len(doc.GetJPEGThumbnail()) > 0 {
			thumb = "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(doc.GetJPEGThumbnail())
		}
		media = &models.SessionMedia{
			Type:            "document",
			Filename:        doc.GetTitle(),
			URL:             doc.GetURL(),
			MimeType:        doc.GetMimetype(),
			ThumbnailBase64: thumb,
			FileSize:        int64(doc.GetFileLength()),
		}
	}

	if ctxInfo != nil {
		isForwarded = ctxInfo.GetIsForwarded() || ctxInfo.GetForwardingScore() > 0
		replyToID = ctxInfo.GetStanzaID()
	}

	return content, isForwarded, media, replyToID
}
