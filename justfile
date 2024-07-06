set dotenv-load

alias d := dev

export EDITOR := 'nvim'

dev:
  bun run dev

fmt:
  prettier --write .
