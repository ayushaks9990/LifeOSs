.PHONY: dev test build

dev:
	docker compose up --build

test:
	cd backend && pytest -q

build:
	cd frontend && npm install && npm run build
	python -m compileall -q backend/app

