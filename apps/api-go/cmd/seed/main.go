package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/xillow/api-go/internal/config"
	"github.com/xillow/api-go/internal/platform/db"
	"github.com/xillow/api-go/internal/seed"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer pool.Close()

	schemaPath := "schema.sql"
	if len(os.Args) > 1 {
		schemaPath = os.Args[1]
	}
	if err := seed.RunSchema(ctx, pool, schemaPath); err != nil {
		fmt.Fprintln(os.Stderr, "schema:", err)
		os.Exit(1)
	}

	samplePath := "sample_listings.json"
	if len(os.Args) > 2 {
		samplePath = os.Args[2]
	}
	listings, err := seed.LoadSample(samplePath)
	if err != nil {
		fmt.Fprintln(os.Stderr, "load sample:", err)
		os.Exit(1)
	}

	dups := seed.FindDuplicateKeys(listings)
	for _, d := range dups {
		detail := "identical entries"
		if d.Conflicting {
			detail = "conflicting values - the last entry wins"
		}
		fmt.Printf("[seed] duplicate key (id=%s, source=%s) appears %dx (%s).\n", d.ID, d.Source, d.Count, detail)
	}

	if err := seed.Upsert(ctx, pool, listings); err != nil {
		fmt.Fprintln(os.Stderr, "upsert:", err)
		os.Exit(1)
	}

	distinct := seed.DistinctKeyCount(listings)
	fmt.Printf("Seeded %d distinct listings (%d rows).\n", distinct, len(listings))
	_ = time.Second
}
