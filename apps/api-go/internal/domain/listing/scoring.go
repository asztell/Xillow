package listing

import (
	"math"
	"time"
)

const (
	DefaultRecencyTauDays = 30.0
	DefaultBudgetWeight   = 0.6
	DefaultRecencyWeight  = 0.4
	msPerDay              = 24 * 60 * 60 * 1000.0
)

type ScoringOptions struct {
	TargetBudget   *float64
	Now            time.Time
	RecencyTauDays float64
	BudgetWeight   float64
	RecencyWeight  float64
}

func BudgetScore(price, targetBudget float64) float64 {
	if !isFinite(targetBudget) || targetBudget <= 0 {
		return 0
	}
	deviation := math.Abs(price-targetBudget) / targetBudget
	return clamp01(1 - deviation)
}

func RecencyScore(listedDate string, now time.Time, tauDays float64) float64 {
	if tauDays <= 0 {
		tauDays = DefaultRecencyTauDays
	}
	listedMs, err := parseDate(listedDate)
	if err != nil || !isFinite(listedMs) {
		return 0
	}
	ageDays := math.Max(0, (float64(now.UnixMilli())-listedMs)/msPerDay)
	return clamp01(math.Exp(-ageDays / tauDays))
}

func ScoreListing(l Listing, opts ScoringOptions) ScoredListing {
	tau := opts.RecencyTauDays
	if tau <= 0 {
		tau = DefaultRecencyTauDays
	}
	bw := opts.BudgetWeight
	if bw == 0 {
		bw = DefaultBudgetWeight
	}
	rw := opts.RecencyWeight
	if rw == 0 {
		rw = DefaultRecencyWeight
	}
	now := opts.Now
	if now.IsZero() {
		now = time.Now()
	}

	recency := RecencyScore(l.ListedDate, now, tau)

	var score float64
	if opts.TargetBudget != nil && *opts.TargetBudget > 0 {
		budget := BudgetScore(l.Price, *opts.TargetBudget)
		totalWeight := bw + rw
		if totalWeight > 0 {
			score = (budget*bw + recency*rw) / totalWeight
		} else {
			score = recency
		}
	} else {
		score = recency
	}

	return ScoredListing{Listing: l, Score: clamp01(score)}
}

func CompareScored(a, b ScoredListing) int {
	if b.Score != a.Score {
		if b.Score > a.Score {
			return 1
		}
		return -1
	}
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

func RankListings(listings []Listing, opts ScoringOptions) []ScoredListing {
	out := make([]ScoredListing, 0, len(listings))
	for _, l := range listings {
		out = append(out, ScoreListing(l, opts))
	}
	// sort descending by score then id/source
	// use simple insertion? Use sort.Slice
	sortSlice(out)
	return out
}

func sortSlice(out []ScoredListing) {
	// bubble sort stable enough for small datasets; but use better:
	n := len(out)
	for i := 1; i < n; i++ {
		j := i
		for j > 0 && CompareScored(out[j-1], out[j]) > 0 {
			out[j-1], out[j] = out[j], out[j-1]
			j--
		}
	}
}

func clamp01(v float64) float64 {
	if math.IsNaN(v) {
		return 0
	}
	if v < 0 {
		return 0
	}
	if v > 1 {
		return 1
	}
	return v
}

func isFinite(v float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0)
}

func parseDate(s string) (float64, error) {
	// Try RFC3339
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		// try date only
		t2, err2 := time.Parse("2006-01-02", s)
		if err2 != nil {
			return 0, err
		}
		t = t2
	}
	return float64(t.UnixMilli()), nil
}
