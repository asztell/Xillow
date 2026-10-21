package config

import (
	"fmt"
	"os"

	"github.com/ilyakaznacheev/cleanenv"
	"github.com/joho/godotenv"
)

type Config struct {
	Port        string `env:"PORT" env-default:"3000"`
	DatabaseURL string `env:"DATABASE_URL" env-required:"true"`
}

func Load() (*Config, error) {
	// Load repo-root .env if present (local dev).
	for _, p := range []string{"../../.env", "../../../.env", ".env"} {
		_ = godotenv.Load(p)
	}
	cfg := &Config{}
	if err := cleanenv.ReadEnv(cfg); err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}
	if cfg.Port == "" {
		cfg.Port = "3000"
	}
	_ = os.Args
	return cfg, nil
}
