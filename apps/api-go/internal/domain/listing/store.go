package listing

import "context"

// Repository is the data-access boundary.
type Repository interface {
	Find(ctx context.Context, filter ListingFilter) ([]Listing, error)
	FindDetail(ctx context.Context, id, source string) (*ListingDetail, error)
}
