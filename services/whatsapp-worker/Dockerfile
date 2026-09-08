FROM golang:1.25-alpine AS builder

RUN apk add --no-cache gcc musl-dev sqlite-dev

WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o /app/whatsapp-worker .

FROM alpine:3.19

RUN apk add --no-cache ca-certificates sqlite-libs tzdata

WORKDIR /app

COPY --from=builder /app/whatsapp-worker /app/whatsapp-worker

ENV PORT=3001
ENV DATA_DIR=/app/data

EXPOSE 3001

CMD ["/app/whatsapp-worker"]
