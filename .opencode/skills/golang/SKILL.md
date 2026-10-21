# Golang API Development Agent Guidelines (Modern Go 1.26+)

You are an expert Golang software engineer adhering to modern production standards, defensive programming, and optimal performance benchmarks.

## 1. Project Layout & Architecture
- Follow a modular, domain-driven `internal/` pattern. Do not over-engineer early with heavy Hexagonal or Java-style layers.
- Avoid global mutable state. Use explicit Dependency Injection (DI) via struct constructors (e.g., `NewHandler(svc Service)`).
- Never use a generic `utils/` or `helpers/` package; name packages explicitly by what they provide (e.g., `jsonctx`, `crypto`).

```text
myapp/
├── cmd/
│   └── api/
│       └── main.go         # App entrypoint (initializes DI, flags, and starts server)
├── internal/
│   ├── config/             # Environment configuration (cleanenv or viper)
│   ├── domain/             # Core business domains
│   │   └── user/
│   │       ├── entity.go    # Domain models
│   │       ├── handler.go   # HTTP/REST Layer (Gin/Chi/Echo router adapters)
│   │       ├── service.go   # Core business logic orchestrator
│   │       └── store.go     # Repository interface and implementation (Postgres/SQLX)
│   └── platform/           # Non-domain foundational logic (logger, database connections)
├── go.mod
└── Makefile
```

## 2. Modern Syntax & Conventions (Go 1.26+)
- **Slices & Maps:** Use `slices.Contains` instead of custom loops. Prefer `min()` and `max()` built-ins over manual ternary logic.
- **Pointers:** Use `new(T)` for allocating pointers safely when initializing default values.
- **Short Circuits:** Use `cmp.Or` to cleanly pick the first non-zero/non-empty value in config fallback chains.
- **Concurrency:** Prefer `sync.WaitGroup` patterns safely. Always pass down a `context.Context` to handle cancellation and deadlines.

## 3. Strict Error Handling
- **Wrapping:** Always wrap errors with context using `%w` instead of returning naked errors. 
  Example: `fmt.Errorf("failed to fetch user from DB: %w", err)`
- **Inspections:** Use type-safe error checking via `errors.Is` and `errors.As`. Never compare error strings directly via `.Error()`.
- **API Boundary:** Ensure database or implementation-specific errors (like `sql.ErrNoRows`) are intercepted at the handler layer and translated into user-friendly HTTP errors to avoid leaking system vulnerabilities.

## 4. REST API Design & Validation
- **JSON Handling:** Use explicit, snake_case struct tags for request/response bodies (e.g., `json:"user_id"`).
- **Validation:** Enforce validation rules on requests using tags (e.g., `validate:"required,email"`) before hitting business services.
- **Framework Routing:** Rely on explicit routing groups (e.g., `/api/v1`) with contextual middleware handling.
- **Context Pass-through:** Ensure the HTTP request context (`r.Context()`) is piped all the way down to SQL queries to enforce network request time-outs.

## 5. Observability & Logging
- **Structured Logs:** Only use `log/slog` (Standard Library Structured Logging). Do not use basic `fmt.Println` or legacy logger packages.
- **Contextual Logging:** Extract request metadata (e.g., `trace_id`) from contexts and inject them directly into your structured logs.

## 6. Testing & Quality Bars
- **Table-Driven Tests:** Write all unit tests using table-driven slice structs (`tt := []struct{...}`).
- **Parallel Testing:** Use `t.Parallel()` inside unit tests to ensure speed. Run test verification locally using `go test -race -v ./...`.
- **Mocks:** Generate interfaces for your external stores and services to easily test application logic deterministically.
