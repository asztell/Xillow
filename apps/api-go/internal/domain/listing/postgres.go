package listing

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresRepository implements Repository using pgx.
type PostgresRepository struct {
	pool *pgxpool.Pool
}

func NewPostgresRepository(pool *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{pool: pool}
}

func (r *PostgresRepository) Find(ctx context.Context, filter ListingFilter) ([]Listing, error) {
	var sb strings.Builder
	sb.WriteString(`SELECT id, source, address, city, state, zip,
  price::double precision AS price, bedrooms, bathrooms::double precision AS bathrooms,
  sqft, latitude, longitude, listed_date, status, description, photos, dup_key
  FROM listings
  WHERE NOT EXISTS (
    SELECT 1 FROM listings AS sibling
    WHERE sibling.dup_key IS NOT NULL
      AND sibling.dup_key = listings.dup_key
      AND (
        sibling.listed_date > listings.listed_date
        OR (sibling.listed_date = listings.listed_date AND sibling.id < listings.id)
        OR (sibling.listed_date = listings.listed_date AND sibling.id = listings.id AND sibling.source < listings.source)
      )
  )`)

	args := []any{}
	if filter.MinPrice != nil {
		sb.WriteString(fmt.Sprintf(" AND price >= $%d", len(args)+1))
		args = append(args, *filter.MinPrice)
	}
	if filter.MaxPrice != nil {
		sb.WriteString(fmt.Sprintf(" AND price <= $%d", len(args)+1))
		args = append(args, *filter.MaxPrice)
	}
	if filter.MinBedrooms != nil {
		sb.WriteString(fmt.Sprintf(" AND bedrooms >= $%d", len(args)+1))
		args = append(args, *filter.MinBedrooms)
	}
	if filter.City != nil {
		sb.WriteString(fmt.Sprintf(" AND city ILIKE $%d", len(args)+1))
		args = append(args, "%"+escapeLike(*filter.City)+"%")
	}
	if filter.Keyword != nil {
		sb.WriteString(fmt.Sprintf(" AND description ILIKE $%d", len(args)+1))
		args = append(args, "%"+escapeLike(*filter.Keyword)+"%")
	}

	rows, err := r.pool.Query(ctx, sb.String(), args...)
	if err != nil {
		return nil, fmt.Errorf("find listings: %w", err)
	}
	defer rows.Close()

	var out []Listing
	for rows.Next() {
		l, err := scanListing(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}
	return out, nil
}

func (r *PostgresRepository) FindDetail(ctx context.Context, id, source string) (*ListingDetail, error) {
	row := r.pool.QueryRow(ctx, `SELECT id, source, address, city, state, zip,
  price::double precision AS price, bedrooms, bathrooms::double precision AS bathrooms,
  sqft, latitude, longitude, listed_date, status, description, photos, dup_key
  FROM listings WHERE id = $1 AND source = $2`, id, source)

	listing, err := scanListing(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("find detail row: %w", err)
	}

	dupKey := listing.DupKey
	if dupKey == nil {
		return &ListingDetail{
			Listing: listing,
			Sources: []ListingSource{toSource(listing, true)},
		}, nil
	}

	rows, err := r.pool.Query(ctx, `SELECT id, source, address, city, state, zip,
  price::double precision AS price, bedrooms, bathrooms::double precision AS bathrooms,
  sqft, latitude, longitude, listed_date, status, description, photos, dup_key
  FROM listings WHERE dup_key = $1
  ORDER BY listed_date DESC, id ASC, source ASC`, *dupKey)
	if err != nil {
		return nil, fmt.Errorf("find siblings: %w", err)
	}
	defer rows.Close()

	var siblings []Listing
	for rows.Next() {
		s, err := scanListing(rows)
		if err != nil {
			return nil, err
		}
		siblings = append(siblings, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows: %w", err)
	}

	sources := make([]ListingSource, 0, len(siblings))
	for i, s := range siblings {
		sources = append(sources, toSource(s, i == 0))
	}

	return &ListingDetail{
		Listing: listing,
		Sources: sources,
	}, nil
}

type scanner interface {
	Scan(dest ...any) error
}

func scanListing(s scanner) (Listing, error) {
	var (
		l          Listing
		bedrooms   *int
		bathrooms  *float64
		sqft       *int
		latitude   *float64
		longitude  *float64
		listedDate time.Time
		desc       *string
		photos     []string
		dupKey     *string
	)
	err := s.Scan(
		&l.ID, &l.Source, &l.Address, &l.City, &l.State, &l.Zip,
		&l.Price, &bedrooms, &bathrooms, &sqft, &latitude, &longitude,
		&listedDate, &l.Status, &desc, &photos, &dupKey,
	)
	if err != nil {
		return Listing{}, err
	}
	l.Bedrooms = bedrooms
	l.Bathrooms = bathrooms
	l.Sqft = sqft
	l.Latitude = latitude
	l.Longitude = longitude
	l.ListedDate = listedDate.UTC().Format("2006-01-02T15:04:05.000Z")
	l.Description = desc
	if photos == nil {
		photos = []string{}
	}
	l.Photos = photos
	l.DupKey = dupKey
	return l, nil
}

func toSource(l Listing, isCurrent bool) ListingSource {
	return ListingSource{
		ID:         l.ID,
		Source:     l.Source,
		Address:    l.Address,
		City:       l.City,
		State:      l.State,
		Zip:        l.Zip,
		Price:      l.Price,
		ListedDate: l.ListedDate,
		Status:     l.Status,
		IsCurrent:  isCurrent,
	}
}

func escapeLike(value string) string {
	r := strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_")
	return r.Replace(value)
}
