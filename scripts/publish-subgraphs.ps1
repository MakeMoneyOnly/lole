# Apollo GraphOS Subgraph Publishing Script
# Run this from the lole project root directory
#
# Usage:
#   1. Set your Apollo API key: $env:APOLLO_KEY = "your-key"
#   2. Run: .\scripts\publish-subgraphs.ps1

$ErrorActionPreference = "Stop"

# Check for API key
if (-not $env:APOLLO_KEY) {
    Write-Host "Error: APOLLO_KEY environment variable not set" -ForegroundColor Red
    Write-Host "Get your key from: https://studio.apollographql.com/settings/api-keys" -ForegroundColor Yellow
    exit 1
}

$GRAPH_REF = "lole-production-tj1sjiw@current"
$ROUTING_URL = "https://lole.app/api/graphql"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Publishing subgraphs to Apollo GraphOS" -ForegroundColor Cyan
Write-Host "Graph: $GRAPH_REF" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Configure Rover
Write-Host "Configuring Rover..." -ForegroundColor Yellow
rover config auth $env:APOLLO_KEY

# Publish each subgraph
$subgraphs = @(
    @{name="orders"; schema="./src/domains/orders/schema.graphql"},
    @{name="menu"; schema="./src/domains/menu/schema.graphql"},
    @{name="payments"; schema="./src/domains/payments/schema.graphql"},
    @{name="guests"; schema="./src/domains/guests/schema.graphql"},
    @{name="staff"; schema="./src/domains/staff/schema.graphql"}
)

foreach ($subgraph in $subgraphs) {
    Write-Host "Publishing $($subgraph.name) subgraph..." -ForegroundColor Yellow
    rover subgraph publish $GRAPH_REF --name $subgraph.name --schema $subgraph.schema --routing-url $ROUTING_URL
    Write-Host "$($subgraph.name) published successfully!" -ForegroundColor Green
    Write-Host ""
}

Write-Host "==========================================" -ForegroundColor Green
Write-Host "All subgraphs published successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Go to Apollo GraphOS Studio to view your graph" -ForegroundColor White
Write-Host "2. Deploy Apollo Router to Railway" -ForegroundColor White
Write-Host "3. Set APOLLO_KEY and APOLLO_GRAPH_REF in Railway" -ForegroundColor White
