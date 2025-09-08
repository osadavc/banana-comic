CREATE TABLE "comics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt" text NOT NULL,
	"hash" text NOT NULL,
	"title" text,
	"user_email" text,
	"ip" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "comics_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comic_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"generation_prompt" text NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_comic_id_comics_id_fk" FOREIGN KEY ("comic_id") REFERENCES "public"."comics"("id") ON DELETE cascade ON UPDATE no action;