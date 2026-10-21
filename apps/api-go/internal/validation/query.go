package validation

import (
	"fmt"
	"math"
	"net/url"
	"strconv"
	"strings"

	"github.com/xillow/api-go/internal/domain/listing"
	"github.com/xillow/api-go/internal/sorting"
)

const (
	DefaultPage     = 1
	DefaultPageSize = 10
	MaxPageSize     = 100
)

type ValidationError struct {
	Code    string
	Message string
	Field   string
}

func (e *ValidationError) Error() string { return e.Message }

type ParseResult struct {
	Params listing.SearchParams
	Err    *ValidationError
}

type rawValue struct {
	kind  string
	value string
}

func readRaw(values url.Values, field string) rawValue {
	v, present := values[field]
	if !present {
		return rawValue{kind: "absent"}
	}
	if len(v) != 1 {
		return rawValue{kind: "invalid"}
	}
	trimmed := strings.TrimSpace(v[0])
	if trimmed == "" {
		return rawValue{kind: "absent"}
	}
	return rawValue{kind: "value", value: trimmed}
}

func failure(field, message string) *ValidationError {
	return &ValidationError{Code: "INVALID_QUERY", Message: message, Field: field}
}

func readStringPtr(values url.Values, field string) (*string, *ValidationError) {
	raw := readRaw(values, field)
	if raw.kind == "invalid" {
		return nil, failure(field, field+" must be a single value")
	}
	if raw.kind == "absent" {
		return nil, nil
	}
	v := raw.value
	return &v, nil
}

func readNumber(values url.Values, field string, integer bool, min *float64, max *float64) (*float64, *ValidationError) {
	raw := readRaw(values, field)
	if raw.kind == "invalid" {
		return nil, failure(field, field+" must be a single value")
	}
	if raw.kind == "absent" {
		return nil, nil
	}
	val, err := strconv.ParseFloat(raw.value, 64)
	if err != nil || math.IsNaN(val) || math.IsInf(val, 0) {
		return nil, failure(field, field+" must be a number")
	}
	if integer && val != math.Trunc(val) {
		return nil, failure(field, field+" must be an integer")
	}
	if min != nil && val < *min {
		// format min
		msg := fmt.Sprintf("%s must be >= %s", field, formatNum(*min, integer))
		return nil, failure(field, msg)
	}
	if max != nil && val > *max {
		msg := fmt.Sprintf("%s must be <= %s", field, formatNum(*max, integer))
		return nil, failure(field, msg)
	}
	return &val, nil
}

func formatNum(v float64, integer bool) string {
	if integer {
		return fmt.Sprintf("%.0f", v)
	}
	// TS uses raw min numbers; for 0 => "0". %g okay.
	return fmt.Sprintf("%g", v)
}

func ParseSearchParams(values url.Values) ParseResult {
	minZero := 0.0
	maxPageSize := float64(MaxPageSize)

	minPrice, err := readNumber(values, "minPrice", false, &minZero, nil)
	if err != nil {
		return ParseResult{Err: err}
	}
	maxPrice, err := readNumber(values, "maxPrice", false, &minZero, nil)
	if err != nil {
		return ParseResult{Err: err}
	}
	minBedsInt := true
	minBedsMin := 0.0
	minBedrooms, err := readNumber(values, "minBedrooms", minBedsInt, &minBedsMin, nil)
	if err != nil {
		return ParseResult{Err: err}
	}
	targetBudget, err := readNumber(values, "targetBudget", false, &minZero, nil)
	if err != nil {
		return ParseResult{Err: err}
	}
	city, err := readStringPtr(values, "city")
	if err != nil {
		return ParseResult{Err: err}
	}
	keyword, err := readStringPtr(values, "keyword")
	if err != nil {
		return ParseResult{Err: err}
	}

	rawSort, err := readStringPtr(values, "sort")
	if err != nil {
		return ParseResult{Err: err}
	}
	var sort *listing.SortKey
	if rawSort != nil {
		sk := listing.SortKey(*rawSort)
		if !sorting.IsSortKey(*rawSort) {
			keys := make([]string, 0, len(sorting.SortKeys()))
			for _, k := range sorting.SortKeys() {
				keys = append(keys, string(k))
			}
			return ParseResult{Err: failure("sort", "sort must be one of: "+strings.Join(keys, ", "))}
		}
		sort = &sk
	}

	pageMin := 1.0
	page, err := readNumber(values, "page", true, &pageMin, nil)
	if err != nil {
		return ParseResult{Err: err}
	}
	pageSizeMin := 1.0
	pageSizeMax := maxPageSize
	pageSize, err := readNumber(values, "pageSize", true, &pageSizeMin, &pageSizeMax)
	if err != nil {
		return ParseResult{Err: err}
	}

	if minPrice != nil && maxPrice != nil && *minPrice > *maxPrice {
		return ParseResult{Err: failure("minPrice", "minPrice must be less than or equal to maxPrice")}
	}

	params := listing.SearchParams{
		MinPrice:     minPrice,
		MaxPrice:     maxPrice,
		MinBedrooms:  intPtrFromFloat(minBedrooms),
		City:         city,
		Keyword:      keyword,
		TargetBudget: targetBudget,
		Sort:         sort,
		Page:         DefaultPage,
		PageSize:     DefaultPageSize,
	}
	if page != nil {
		params.Page = int(*page)
	}
	if pageSize != nil {
		params.PageSize = int(*pageSize)
	}
	// minBedrooms pointer type *int
	_ = minBedsInt
	return ParseResult{Params: params}
}

func intPtrFromFloat(v *float64) *int {
	if v == nil {
		return nil
	}
	i := int(*v)
	return &i
}
