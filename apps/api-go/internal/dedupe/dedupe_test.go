package dedupe

import (
	"testing"

	"github.com/xillow/api-go/internal/domain/listing"
)

func TestDuplicateKeyUnitGuard(t *testing.T) {
	a := listing.Listing{ID: "1", Source: "S", Address: "123 Main St, Apt 4B", City: "X", Latitude: floatPtr(1), Longitude: floatPtr(2)}
	b := listing.Listing{ID: "2", Source: "S", Address: "123 Main St, Apt 5C", City: "X", Latitude: floatPtr(1), Longitude: floatPtr(2)}
	ka := DuplicateKey(a)
	kb := DuplicateKey(b)
	if ka == nil || kb == nil || *ka == *kb {
		t.Fatalf("unit guard failed: %v %v", ka, kb)
	}
}

func floatPtr(v float64) *float64 { return &v }
