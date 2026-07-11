ALTER TABLE "metrics_snapshots" ADD COLUMN "reach" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "metrics_snapshots" ADD COLUMN "link_clicks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "metrics_snapshots" ADD COLUMN "conversion_value_minor" integer DEFAULT 0 NOT NULL;