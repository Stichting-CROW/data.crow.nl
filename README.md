# data.crow.nl

This package is the linked data resolver for data.crow.nl.
Built on Azure Functions, it matches regex request URLs with target destinations where the actual data is stored.
It redirects using HTTP `307 TEMPORARY REDIRECT`.
This is not `302 FOUND`, as that may [change HTTP method][method].

[method]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Redirections#temporary_redirections

## New redirects

New redirects are added in [redirects.json].
If you edit with a JSON-schema compatible editor (e.g. Visual Studio Code or [GitHub.dev]), you get autocomplete suggestions.

[redirects.json]: data/redirects.json
[github.dev]: https://github.dev/Stichting-CROW/data.crow.nl/blob/main/data/redirects.json

## Deployment

Commit your changes in a branch and open a pull request.
After approval and merging, a [GitHub Action] will ensure deployment of your changes.

[github action]: .github/workflows/deploy.yaml

## Issues and Pull Request

Issues and PR’s are welcome.
