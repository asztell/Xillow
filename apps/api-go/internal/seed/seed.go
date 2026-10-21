package seed

import (
	"context"
	"encoding/json"
	"os"
	"sort"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xillow/api-go/internal/dedupe"
	"github.com/xillow/api-go/internal/domain/listing"
)

type SampleListing struct {
	ID          string   `json:"id"`
	Source      string   `json:"source"`
	Address     string   `json:"address"`
	City        string   `json:"city"`
	State       string   `json:"state"`
	Zip         string   `json:"zip"`
	Price       float64  `json:"price"`
	Bedrooms    *int     `json:"bedrooms"`
	Bathrooms   *float64 `json:"bathrooms"`
	Sqft        *int     `json:"sqft"`
	Latitude    *float64 `json:"latitude"`
	Longitude   *float64 `json:"longitude"`
	ListedDate  string   `json:"listedDate"`
	Status      string   `json:"status"`
	Description *string  `json:"description"`
	Photos      []string `json:"photos"`
}

func toTimestamp(value string) string {
	// date-only
	if len(value) == 10 {
		return value + "T00:00:00.000Z"
	}
	return value
}

type DuplicateKeyWarning struct {
	ID          string
	Source      string
	Count       int
	Conflicting bool
}

func listingKey(l SampleListing) string { return l.ID + "\x00" + l.Source }

func canonical(l SampleListing) string {
	// simple JSON of struct is order-stable enough? Use map via json.Marshal of map.
	m := map[string]any{
		"id": l.ID, "source": l.Source, "address": l.Address, "city": l.City,
		"state": l.State, "zip": l.Zip, "price": l.Price, "bedrooms": l.Bedrooms,
		"bathrooms": l.Bathrooms, "sqft": l.Sqft, "latitude": l.Latitude,
		"longitude": l.Longitude, "listedDate": l.ListedDate, "status": l.Status,
		"description": l.Description, "photos": l.Photos,
	}
	b, _ := json.Marshal(m)
	return string(b)
}

func FindDuplicateKeys(listings []SampleListing) []DuplicateKeyWarning {
	firstSeen := map[string]struct {
		id, source, payload string
	}{}
	counts := map[string]int{}
	conflicting := map[string]bool{}

	for _, l := range listings {
		key := listingKey(l)
		counts[key]++
		if f, ok := firstSeen[key]; !ok {
			firstSeen[key] = struct{ id, source, payload string }{id: l.ID, source: l.Source, payload: canonical(l)}
		} else if f.payload != canonical(l) {
			conflicting[key] = true
		}
	}

	var out []DuplicateKeyWarning
	for key, f := range firstSeen {
		if counts[key] <= 1 {
			continue
		}
		out = append(out, DuplicateKeyWarning{
			ID: f.id, Source: f.source, Count: counts[key], Conflicting: conflicting[key],
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].ID != out[j].ID {
			return out[i].ID < out[j].ID
		}
		return out[i].Source < out[j].Source
	})
	return out
}

func DistinctKeyCount(listings []SampleListing) int {
	set := map[string]bool{}
	for _, l := range listings {
		set[listingKey(l)] = true
	}
	return len(set)
}

func lastByKey(listings []SampleListing) []SampleListing {
	byKey := map[string]SampleListing{}
	for _, l := range listings {
		byKey[listingKey(l)] = l
	}
	out := make([]SampleListing, 0, len(byKey))
	for _, l := range byKey {
		out = append(out, l)
	}
	return out
}

func Upsert(ctx context.Context, pool *pgxpool.Pool, listings []SampleListing) error {
	rows := lastByKey(listings)
	if len(rows) == 0 {
		return nil
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	const chunk = 500
	for start := 0; start < len(rows); start += chunk {
		end := start + chunk
		if end > len(rows) {
			end = len(rows)
		}
		chunkRows := rows[start:end]
		// build multi-row insert
		// Use pgx batch? Simpler: execute per row upsert in transaction.
		for _, l := range chunkRows {
			ld, _ := time.Parse(time.RFC3339, toTimestamp(l.ListedDate))
			dk := dedupe.DuplicateKey(listing.Listing{
				ID: l.ID, Source: l.Source, Address: l.Address, City: l.City,
				Latitude: l.Latitude, Longitude: l.Longitude,
			})
			var dupKey any
			if dk != nil {
				dupKey = *dk
			}
			photos := l.Photos
			if photos == nil {
				photos = []string{}
			}
			_, err := tx.Exec(ctx, `INSERT INTO listings
 (id,source,address,city,state,zip,price,bedrooms,bathrooms,sqft,latitude,longitude,listed_date,status,description,photos,dup_key)
 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
 ON CONFLICT (id,source) DO UPDATE SET
 address=EXCLUDED.address, city=EXCLUDED.city, state=EXCLUDED.state, zip=EXCLUDED.zip,
 price=EXCLUDED.price, bedrooms=EXCLUDED.bedrooms, bathrooms=EXCLUDED.bathrooms, sqft=EXCLUDED.sqft,
 latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, listed_date=EXCLUDED.listed_date,
 status=EXCLUDED.status, description=EXCLUDED.description, photos=EXCLUDED.photos, dup_key=EXCLUDED.dup_key`,
				l.ID, l.Source, l.Address, l.City, l.State, l.Zip, l.Price, l.Bedrooms, l.Bathrooms, l.Sqft,
				l.Latitude, l.Longitude, ld, l.Status, l.Description, photos, dupKey)
			if err != nil {
				return err
			}
		}
	}
	return tx.Commit(ctx)
}

func RunSchema(ctx context.Context, pool *pgxpool.Pool, schemaPath string) error {
	b, err := os.ReadFile(schemaPath)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, string(b))
	return err
}

func LoadSample(path string) ([]SampleListing, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var out []SampleListing
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, err
	}
	return out, nil
}
