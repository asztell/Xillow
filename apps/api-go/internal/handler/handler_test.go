package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/xillow/api-go/internal/domain/listing"
	"github.com/xillow/api-go/internal/service"
)

type fakeRepo struct {
	listings []listing.Listing
}

func (f *fakeRepo) Find(ctx context.Context, filter listing.ListingFilter) ([]listing.Listing, error) {
	return f.listings, nil
}
func (f *fakeRepo) FindDetail(ctx context.Context, id, source string) (*listing.ListingDetail, error) {
	for _, l := range f.listings {
		if l.ID == id && l.Source == source {
			return &listing.ListingDetail{Listing: l, Sources: []listing.ListingSource{{ID: l.ID, Source: l.Source, Price: l.Price, ListedDate: l.ListedDate, Status: l.Status, IsCurrent: true}}}, nil
		}
	}
	return nil, nil
}

func TestHealth(t *testing.T) {
	h := New(service.New(&fakeRepo{}), nil)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	h.Health(rr, req)
	if rr.Code != 200 {
		t.Fatal(rr.Code)
	}
}

func TestListEmpty(t *testing.T) {
	repo := &fakeRepo{listings: []listing.Listing{}}
	h := New(service.New(repo), nil)
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/listings", nil)
	h.List(rr, req)
	if rr.Code != 200 {
		t.Fatal(rr.Code)
	}
	var body map[string]any
	json.Unmarshal(rr.Body.Bytes(), &body)
	if body["total"].(float64) != 0 {
		t.Fatalf("total: %v", body["total"])
	}
}
