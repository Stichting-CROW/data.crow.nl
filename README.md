# data.crow.nl

This package is the linked data resolver for data.crow.nl.
Built on Azure Functions, it matches regex request URLs with target destinations where the actual data is stored.
It redirects using HTTP `302 FOUND`.

Dit pakket is de linkeddatadoorverwijzer voor data.crow.nl.
Gebouwd met Azure Functions, zoekt het de juiste doorverwijzing van HTTP-verzoeken naar de server.
Op de gevonden bestemming wordt de daadwerkelijke data gehost.

## New redirects / Nieuwe doorverwijzingen

New redirects are added in [redirects.json].
If you edit with a JSON-schema compatible editor (e.g. Visual Studio Code), you get autocomplete suggestions.

Voeg nieuwe doorverwijzingen toe aan [redirects.json].
Als je bewerkt met een programma dat JSON-schema’s begrijpt (bijv. Visual Studio Code), krijg je automatisch invulsuggesties.

[redirects.json]: data/redirects.json

## Deployment / Uitrol

Commit your changes in a branch and open a pull request. 
After approval and merging, a [GitHub Action] will ensure deployment of your changes.

*Commit* je wijzingen in een *branch* en open een *pull request*.
Na goedkeuring en samenvoeging zorgt een [GitHub Action] dat de wijzingen uitgerold worden.

[GitHub Action]: .github/workflows/deploy.yaml

## Issues and Pull Request

Issues and PR’s are welcome.
