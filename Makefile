.PHONY: build test check pack clean
build:
	npm run build
test:
	npm test
check:
	npm run check
pack:
	npm run test:package
clean:
	npm run clean
