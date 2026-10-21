package sorting

import (
	"sort"

	"github.com/xillow/api-go/internal/domain/listing"
)

var sortKeySet = map[listing.SortKey]bool{
	listing.SortRecommended:   true,
	listing.SortPriceDesc:     true,
	listing.SortPriceAsc:      true,
	listing.SortNewest:        true,
	listing.SortBedroomsDesc:  true,
	listing.SortBathroomsDesc: true,
	listing.SortSqftDesc:      true,
}

var sortedKeys = []listing.SortKey{
	listing.SortRecommended,
	listing.SortPriceDesc,
	listing.SortPriceAsc,
	listing.SortNewest,
	listing.SortBedroomsDesc,
	listing.SortBathroomsDesc,
	listing.SortSqftDesc,
}

func SortKeys() []listing.SortKey { return sortedKeys }

func IsSortKey(value string) bool {
	_, ok := sortKeySet[listing.SortKey(value)]
	return ok
}

const lowest = -1 << 63 // not used for pointer; use sentinel

func byIdThenSource(a, b listing.ScoredListing) int {
	if a.ID != b.ID {
		if a.ID < b.ID {
			return -1
		}
		return 1
	}
	if a.Source != b.Source {
		if a.Source < b.Source {
			return -1
		}
		return 1
	}
	return 0
}

func nullableInt(v *int) int {
	if v == nil {
		return -1 << 62
	}
	return *v
}

func nullableFloat(v *float64) float64 {
	if v == nil {
		return -1 << 62 // not exact but okay? Use -inf
	}
	return *v
}

func SortListings(listings []listing.ScoredListing, sortKey listing.SortKey) []listing.ScoredListing {
	out := append([]listing.ScoredListing(nil), listings...)
	switch sortKey {
	case listing.SortRecommended:
		sort.SliceStable(out, func(i, j int) bool {
			// compare scored descending
			if out[j].Score != out[i].Score {
				return out[j].Score < out[i].Score
			}
			if out[i].ID != out[j].ID {
				return out[i].ID < out[j].ID
			}
			return out[i].Source < out[j].Source
		})
	case listing.SortPriceDesc:
		sort.SliceStable(out, func(i, j int) bool {
			if out[i].Price != out[j].Price {
				return out[i].Price > out[j].Price
			}
			return byIdThenSource(out[i], out[j]) < 0
		})
	case listing.SortPriceAsc:
		sort.SliceStable(out, func(i, j int) bool {
			if out[i].Price != out[j].Price {
				return out[i].Price < out[j].Price
			}
			return byIdThenSource(out[i], out[j]) < 0
		})
	case listing.SortNewest:
		sort.SliceStable(out, func(i, j int) bool {
			if out[i].ListedDate != out[j].ListedDate {
				return out[i].ListedDate > out[j].ListedDate
			}
			return byIdThenSource(out[i], out[j]) < 0
		})
	case listing.SortBedroomsDesc:
		sort.SliceStable(out, func(i, j int) bool {
			ai, aj := nullableInt(out[i].Bedrooms), nullableInt(out[j].Bedrooms)
			if ai != aj {
				return ai > aj
			}
			return byIdThenSource(out[i], out[j]) < 0
		})
	case listing.SortBathroomsDesc:
		sort.SliceStable(out, func(i, j int) bool {
			ai, aj := nullableFloat(out[i].Bathrooms), nullableFloat(out[j].Bathrooms)
			if ai != aj {
				return ai > aj
			}
			return byIdThenSource(out[i], out[j]) < 0
		})
	case listing.SortSqftDesc:
		sort.SliceStable(out, func(i, j int) bool {
			ai, aj := nullableInt(out[i].Sqft), nullableInt(out[j].Sqft)
			if ai != aj {
				return ai > aj
			}
			return byIdThenSource(out[i], out[j]) < 0
		})
	default:
		panic("unsupported sort key: " + string(sortKey))
	}
	return out
}
