package dedupe

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/xillow/api-go/internal/domain/listing"
)

var streetAbbreviations = map[string]string{
	"st": "street", "str": "street", "ave": "avenue", "av": "avenue",
	"blvd": "boulevard", "rd": "road", "dr": "drive", "ln": "lane",
	"ct": "court", "pl": "place", "ter": "terrace", "terr": "terrace",
	"cir": "circle", "hwy": "highway", "pkwy": "parkway", "sq": "square",
}

var unitMarkers = map[string]bool{
	"apt": true, "apartment": true, "unit": true, "ste": true, "suite": true,
}

const geoPrecision = 4

var nonTokenChars = regexp.MustCompile(`[^a-z0-9\s-]`)
var leadingStreetNumber = regexp.MustCompile(`^\d+[a-z]?$`)

type NormalizedAddress struct {
	Number    string
	HasNumber bool
	Street    string
	Unit      *string
}

func NormalizeAddress(address string) NormalizedAddress {
	tokens := strings.Fields(strings.ToLower(strings.ReplaceAll(address, "#", " unit ")))
	cleaned := nonTokenChars.ReplaceAllString(strings.Join(tokens, " "), " ")
	tokens = strings.Fields(cleaned)

	var number string
	hasNumber := false
	if len(tokens) > 0 && leadingStreetNumber.MatchString(tokens[0]) {
		number = tokens[0]
		hasNumber = true
		tokens = tokens[1:]
	}

	var unit *string
	unitIndex := -1
	for i, t := range tokens {
		if unitMarkers[t] {
			unitIndex = i
			break
		}
	}
	if unitIndex != -1 {
		if unitIndex+1 < len(tokens) {
			u := tokens[unitIndex+1]
			unit = &u
			tokens = append(tokens[:unitIndex], tokens[unitIndex+2:]...)
		} else {
			tokens = append(tokens[:unitIndex], tokens[unitIndex+1:]...)
		}
	}

	streetTokens := make([]string, 0, len(tokens))
	for _, t := range tokens {
		if canon, ok := streetAbbreviations[t]; ok {
			streetTokens = append(streetTokens, canon)
		} else {
			streetTokens = append(streetTokens, t)
		}
	}
	street := strings.Join(streetTokens, " ")

	return NormalizedAddress{Number: number, HasNumber: hasNumber, Street: street, Unit: unit}
}

func DuplicateKey(l listing.Listing) *string {
	na := NormalizeAddress(l.Address)

	if l.Latitude != nil && l.Longitude != nil {
		geo := fmt.Sprintf("%.*f,%.*f", geoPrecision, *l.Latitude, geoPrecision, *l.Longitude)
		unit := ""
		if na.Unit != nil {
			unit = *na.Unit
		}
		key := "geo:" + geo + ":" + unit
		return &key
	}

	if !na.HasNumber || na.Street == "" {
		return nil
	}
	city := strings.ToLower(l.City)
	unit := ""
	if na.Unit != nil {
		unit = *na.Unit
	}
	key := "addr:" + city + ":" + na.Number + ":" + na.Street + ":" + unit
	return &key
}
