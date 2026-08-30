FROM alpine:3.19

RUN apk add --no-cache ca-certificates sqlite-libs tzdata

WORKDIR /app

COPY whatsapp-worker-linux /app/whatsapp-worker
RUN chmod +x /app/whatsapp-worker

ENV PORT=3001
ENV DATA_DIR=/app/data

EXPOSE 3001

CMD ["/app/whatsapp-worker"]
