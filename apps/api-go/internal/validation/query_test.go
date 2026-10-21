package validation

import (
	"net/url"
	"testing"
)

func TestParseSearchParamsBasic(t *testing.T) {
	v := url.Values{}
	v.Set("minPrice", "100")
	v.Set("maxPrice", "200")
	v.Set("page", "2")
	v.Set("pageSize", "5")
	res := ParseSearchParams(v)
	if res.Err != nil {
		t.Fatal(res.Err)
	}
	if res.Params.MinPrice == nil || *res.Params.MinPrice != 100 {
		t.Fatalf("minPrice")
	}
	if res.Params.Page != 2 || res.Params.PageSize != 5 {
		t.Fatalf("page")
	}
}

func TestParseSearchParamsInvalid(t *testing.T) {
	cases := []struct {
		q     string
		field string
	}{
		{"minPrice=lots", "minPrice"},
		{"pageSize=0", "pageSize"},
		{"minPrice=600&maxPrice=400", "minPrice"},
		{"sort=popular", "sort"},
	}
	for _, c := range cases {
		v, _ := url.ParseQuery(c.q)
		res := ParseSearchParams(v)
		if res.Err == nil || res.Err.Field != c.field {
			t.Fatalf("case %s: %+v", c.q, res.Err)
		}
	}
}
