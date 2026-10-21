package sorting

import (
	"testing"

	"github.com/xillow/api-go/internal/domain/listing"
)

func TestSortPriceAsc(t *testing.T) {
	in := []listing.ScoredListing{
		{Listing: listing.Listing{ID: "A", Source: "S", Price: 200}, Score: 0},
		{Listing: listing.Listing{ID: "B", Source: "S", Price: 100}, Score: 0},
	}
	out := SortListings(in, listing.SortPriceAsc)
	if out[0].Price != 100 {
		t.Fatalf("expected 100 first")
	}
}
