package listing

import "encoding/json"

// ListingStatus mirrors the shared contract.
type ListingStatus string

const (
	StatusActive  ListingStatus = "active"
	StatusPending ListingStatus = "pending"
	StatusSold    ListingStatus = "sold"
)

// Listing is the domain entity and API response shape.
type Listing struct {
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
	DupKey      *string  `json:"dup_key"`
}

// ScoredListing is a Listing annotated with its relevance score.
type ScoredListing struct {
	Listing
	Score float64 `json:"score"`
}

// ListingSource is the lightweight provenance entry.
type ListingSource struct {
	ID         string  `json:"id"`
	Source     string  `json:"source"`
	Address    string  `json:"address"`
	City       string  `json:"city"`
	State      string  `json:"state"`
	Zip        string  `json:"zip"`
	Price      float64 `json:"price"`
	ListedDate string  `json:"listedDate"`
	Status     string  `json:"status"`
	IsCurrent  bool    `json:"isCurrent"`
}

// ListingDetail is the requested row plus all of its feed siblings.
type ListingDetail struct {
	Listing
	Sources []ListingSource `json:"sources"`
}

// MarshalJSON keeps embedded Listing fields at the top level.
func (d ListingDetail) MarshalJSON() ([]byte, error) {
	type alias ListingDetail
	// ListingDetail embeds Listing; default marshaling already flattens.
	return json.Marshal(alias(d))
}

// SearchParams is the validated, normalized query.
type SearchParams struct {
	MinPrice     *float64
	MaxPrice     *float64
	MinBedrooms  *int
	City         *string
	Keyword      *string
	TargetBudget *float64
	Sort         *SortKey
	Page         int
	PageSize     int
}

// SortKey is a validated sort value.
type SortKey string

const (
	SortRecommended   SortKey = "recommended"
	SortPriceDesc     SortKey = "price_desc"
	SortPriceAsc      SortKey = "price_asc"
	SortNewest        SortKey = "newest"
	SortBedroomsDesc  SortKey = "bedrooms_desc"
	SortBathroomsDesc SortKey = "bathrooms_desc"
	SortSqftDesc      SortKey = "sqft_desc"
)

// SearchResult is the paginated response.
type SearchResult struct {
	Page       int             `json:"page"`
	PageSize   int             `json:"pageSize"`
	Total      int             `json:"total"`
	TotalPages int             `json:"totalPages"`
	HasNext    bool            `json:"hasNext"`
	HasPrev    bool            `json:"hasPrev"`
	Results    []ScoredListing `json:"results"`
}

// ListingFilter is the subset pushed down to the store.
type ListingFilter struct {
	MinPrice    *float64
	MaxPrice    *float64
	MinBedrooms *int
	City        *string
	Keyword     *string
}
