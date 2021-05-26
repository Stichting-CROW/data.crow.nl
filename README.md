# data.crow.nl

This package is the linked data resolver for data.crow.nl.
Built on Azure Functions, it matches regex request URLs with target destinations where the actual data is stored.
It redirects using HTTP `302 FOUND`.

Dit pakket is de linkeddatadoorverwijzer voor data.crow.nl.
Gebouwd met Azure Functions, zoekt het de juiste doorverwijzing van HTTP-verzoeken naar de server.
Op de gevonden bestemming wordt de daadwerkelijke data gehost.

## New redirects

New redirects are added in [redirects.json](data/redirects.json).
If you edit with a JSON-schema compatible editor (e.g. Visual Studio Code), you get autocomplete suggestions from [redirects-schema.json](data/redirects-schema.json).

## Issues and Pull Request

Issues and PR’s are welcome.
