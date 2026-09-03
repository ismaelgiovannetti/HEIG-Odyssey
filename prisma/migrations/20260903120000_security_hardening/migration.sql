-- Redis Streams garantit une livraison au moins une fois. Ce reçu persistant
-- rend le traitement des progressions de quête idempotent entre workers.
CREATE TABLE "processed_domain_event" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_domain_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "processed_domain_event_eventId_key"
ON "processed_domain_event"("eventId");

CREATE UNIQUE INDEX "processed_domain_event_aggregateId_key"
ON "processed_domain_event"("aggregateId");
