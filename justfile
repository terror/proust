set dotenv-load

alias d := dev
alias b := build

export EDITOR := 'nvim'

build:
  bun run build

dev:
  bun run dev

fmt:
  prettier --write .
