package listing

import (
	"testing"
	"time"
)

func TestBudgetScore(t *testing.T) {
	if BudgetScore(450000, 450000) != 1 {
		t.Fatal("expected 1")
	}
	if BudgetScore(900000, 450000) != 0 {
		t.Fatal("expected 0")
	}
}

func TestRankListingsTieBreak(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	ls := []Listing{
		{ID: "B", Source: "S", Price: 100, ListedDate: "2026-01-01T00:00:00.000Z"},
		{ID: "A", Source: "S", Price: 100, ListedDate: "2026-01-01T00:00:00.000Z"},
	}
	scored := RankListings(ls, ScoringOptions{Now: now})
	if scored[0].ID != "A" {
		t.Fatalf("tie break by id expected A first, got %s", scored[0].ID)
	}
}
