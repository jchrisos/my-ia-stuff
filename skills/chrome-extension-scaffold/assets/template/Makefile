# {{NAME}} — developer tasks.
#
# There is NO build step: this is a plain unpacked Manifest V3 extension loaded straight
# from the repo root. These targets only test, validate and package it.
#
#   make          # help
#   make test     # unit tests (no browser)
#   make check    # syntax-check every JS file + validate the JSON manifests
#   make load     # print the load-unpacked / reload steps
#   make package  # dist/<name>-<version>.zip for the Chrome Web Store

SHELL := /bin/bash
.DEFAULT_GOAL := help

NAME    := {{NAME}}
VERSION := $(shell node -p "require('./package.json').version")

.PHONY: help test check load package clean

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

test: ## Run the unit tests (node --test)
	node --test 'tests/*.test.mjs'

check: ## Syntax-check all JS, validate the JSON manifests
	@for f in $$(find content background theme popup tests -type f \( -name '*.js' -o -name '*.mjs' \)); do \
		node --check "$$f" || exit 1; \
	done
	@python3 -m json.tool manifest.json >/dev/null && echo "manifest.json OK"
	@python3 -m json.tool package.json >/dev/null && echo "package.json OK"

load: ## Print the load-unpacked / reload steps
	@echo "1. chrome://extensions -> enable Developer mode -> Load unpacked -> select this repo root"
	@echo "2. After editing content scripts or CSS: reload the page (Cmd+R)"
	@echo "3. After editing background/service-worker.js: click the extension's reload icon, then reload the page"
	@echo "4. After editing manifest.json: reload the extension, then the page"

package: check test ## Build dist/<name>-<version>.zip for the Chrome Web Store
	@mkdir -p dist
	@rm -f "dist/$(NAME)-$(VERSION).zip"
	@zip -qr "dist/$(NAME)-$(VERSION).zip" manifest.json background content theme popup icons \
		-x '*.DS_Store'
	@echo "built dist/$(NAME)-$(VERSION).zip"

clean: ## Remove build artifacts
	@rm -rf dist
