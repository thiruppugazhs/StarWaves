.PHONY: run build vet

run:
	CGO_ENABLED=1 go run main.go

build:
	CGO_ENABLED=1 go build -o whatsapp-worker main.go

vet:
	go vet ./...
