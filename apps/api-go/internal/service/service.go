package service

import (
	"context"
	"time"

	"github.com/xillow/api-go/internal/domain/listing"
	"github.com/xillow/api-go/internal/sorting"
)

type Service struct {
	Repo listing.Repository
	Now  func() time.Time
}

func New(repo listing.Repository) *Service {
	return &Service{Repo: repo, Now: time.Now}
}

func (s *Service) Search(ctx context.Context, params listing.SearchParams) (listing.SearchResult, error) {
	listings, err := s.Repo.Find(ctx, listing.ListingFilter{
		MinPrice:    params.MinPrice,
		MaxPrice:    params.MaxPrice,
		MinBedrooms: params.MinBedrooms,
		City:        params.City,
		Keyword:     params.Keyword,
	})
	if err != nil {
		return listing.SearchResult{}, err
	}

	now := time.Time{}
	if s.Now != nil {
		now = s.Now()
	}
	if now.IsZero() {
		now = time.Now()
	}

	scored := listing.RankListings(listings, listing.ScoringOptions{
		TargetBudget: params.TargetBudget,
		Now:          now,
	})

	var sorted []listing.ScoredListing
	if params.Sort != nil && *params.Sort != listing.SortRecommended {
		sorted = sorting.SortListings(scored, *params.Sort)
	} else {
		sorted = scored
	}

	total := len(sorted)
	totalPages := 0
	if total > 0 {
		totalPages = (total + params.PageSize - 1) / params.PageSize
	}
	start := (params.Page - 1) * params.PageSize
	end := start + params.PageSize
	if start > total {
		start = total
	}
	if end > total {
		end = total
	}
	results := sorted[start:end]
	if results == nil {
		results = []listing.ScoredListing{}
	}

	return listing.SearchResult{
		Page:       params.Page,
		PageSize:   params.PageSize,
		Total:      total,
		TotalPages: totalPages,
		HasNext:    params.Page < totalPages,
		HasPrev:    params.Page > 1,
		Results:    results,
	}, nil
}

func (s *Service) Detail(ctx context.Context, id, source string) (*listing.ListingDetail, error) {
	return s.Repo.FindDetail(ctx, id, source)
}
